const axios = require('axios');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'fallback_secret');

async function test() {
  try {
    const res = await axios.put('http://localhost:3001/api/patients/2adf0ca7-26d8-4bb5-9652-5b44dedf1d8b', {
      smoking: JSON.stringify(["Current"])
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(res.data);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
