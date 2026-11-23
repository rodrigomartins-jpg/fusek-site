// netlify/functions/chat.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://otltdvbkqvamgfgheyxi.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_kVGWlkJkfCJybBwwgmp2cQ_v9vWwoI9'
);

exports.handler = async (event) => {
  console.log('Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers));
  console.log('Body:', event.body);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { pergunta, periodId } = JSON.parse(event.body || '{}');
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace('Bearer ', '');

    console.log('Token recebido:', token ? 'sim' : 'não');

    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Não autenticado' }) };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('User:', user ? user.id : 'não encontrado', 'Error:', authError);

    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    const { data: cu, error: cuError } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .single();

    console.log('Client user:', cu, 'Error:', cuError);

    if (!cu) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Cliente não vinculado' }) };
    }

    const clientId = cu.client_id;

    const { data: indicators } = await supabase
      .from('indicators')
      .select('indicador, valor')
      .eq('client_id', clientId)
      .eq('period_id', periodId);

    let resposta = 'Dados do período:\n';
    if (indicators && indicators.length) {
      resposta += indicators.map(i => `${i.indicador}: ${i.valor}`).join('\n');
    } else {
      resposta += 'Nenhum indicador encontrado para este período.';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta })
    };
  } catch (err) {
    console.error('Erro:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};