const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
  const form = new FormData();
  form.append('leg_id', '128'); // some valid leg_id
  form.append('leg_side', 'right');
  form.append('phase', 'sfj_gsv');
  form.append('segment', 'sfj');
  form.append('view_type', 'anatomy_mickey');
  form.append('compressible', 'true');
  form.append('diameter_mm', '5.5');
  
  try {
    const res = await axios.post('http://localhost:3001/api/doppler-images', form, {
      headers: form.getHeaders(),
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response ? err.response.data : err.message);
  }
}

run();
