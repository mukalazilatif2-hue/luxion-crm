const { neon } = require('@neondatabase/serverless');

function getDb() {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('No database URL configured');
  return neon(url);
}

const H = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ok  = (d, s=200) => ({ statusCode:s, headers:H, body:JSON.stringify(d) });
const err = (m, s=400) => ({ statusCode:s, headers:H, body:JSON.stringify({error:m}) });
const pre = ()         => ({ statusCode:204, headers:H, body:'' });

module.exports = { getDb, ok, err, pre };
