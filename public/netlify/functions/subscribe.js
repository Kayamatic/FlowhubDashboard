const ALLOWED_ORIGINS = ['https://askdiggory.com', 'https://www.askdiggory.com', 'https://askclyde.co', 'https://www.askclyde.co'];

exports.handler = async (event) => {
  // Method check
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // CSRF: origin check
  const origin = event.headers.origin || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  // API key from environment
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Input validation
  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email required' }) };
  }

  // Sanitize string fields — max lengths, strip control chars
  const sanitize = (val, max = 200) =>
    typeof val === 'string' ? val.replace(/[\x00-\x1F]/g, '').slice(0, max) : '';

  const clean = {
    email,
    firstName:    sanitize(payload.firstName, 100),
    lastName:     sanitize(payload.lastName, 100),
    source:       sanitize(payload.source, 50),
    subscribed:   payload.subscribed === true,
    userGroup:    sanitize(payload.userGroup, 100),
    phone:        sanitize(payload.phone, 30),
    businessName: sanitize(payload.businessName, 200),
    locations:    parseInt(payload.locations, 10) || undefined,
    posSystem:    sanitize(payload.posSystem, 50),
    notes:        sanitize(payload.notes, 1000),
  };

  // Remove undefined fields
  Object.keys(clean).forEach(k => clean[k] === undefined && delete clean[k]);

  try {
    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(clean)
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Upstream error' })
    };
  }
};
