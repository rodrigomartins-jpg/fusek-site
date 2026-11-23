// netlify/functions/chat.js
// Coloque este arquivo em: netlify/functions/chat.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://otltdvbkqvamgfgheyxi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_kVGWlkJkfCJybBwwgmp2cQ_v9vWwoI9'
);

const QUERIES = {
  dre: async (clientId, periodId) => {
    const { data } = await supabase
      .from('dre_lines')
      .select('conta, valor')
      .eq('client_id', clientId)
      .eq('period_id', periodId);
    return data || [];
  },
  indicators: async (clientId, periodId) => {
    const { data } = await supabase
      .from('indicators')
      .select('indicador, valor')
      .eq('client_id', clientId)
      .eq('period_id', periodId);
    return data || [];
  },
  forecast: async (clientId, periodId) => {
    const { data } = await supabase
      .from('cash_forecast_13w')
      .select('semana, entradas, saidas, saldo')
      .eq('client_id', clientId)
      .eq('period_id', periodId)
      .order('semana');
    return data || [];
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { pergunta, periodId } = JSON.parse(event.body || '{}');
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Não autenticado' }) };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    const { data: cu } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .single();

    if (!cu) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Cliente não vinculado' }) };
    }

    const clientId = cu.client_id;

    const contexto = {
      dre: await QUERIES.dre(clientId, periodId),
      indicators: await QUERIES.indicators(clientId, periodId),
      forecast: await QUERIES.forecast(clientId, periodId)
    };

    // Resposta simples para o MVP (substituir por chamada xAI depois)
    let resposta = 'Dados do período:\n';
    if (contexto.indicators.length) {
      resposta += contexto.indicators.map(i => `${i.indicador}: ${i.valor}`).join('\n');
    } else {
      resposta += 'Nenhum indicador encontrado para este período.';
    }

    await supabase.from('chat_messages').insert({
      client_id: clientId,
      user_id: user.id,
      pergunta,
      resposta,
      status: 'respondida'
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
