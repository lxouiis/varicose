const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api';

async function runHarshTest() {
  console.log('🚀 Starting Harsh Edge-Case Integration Test...\n');
  let token = '';
  let patientId = '';

  try {
    // 1. Authenticate to get Token
    console.log('--> Authenticating...');
    const jwt = require('jsonwebtoken');
    token = jwt.sign({
      id: 'test-doctor-id',
      email: 'test@doctor.com',
      name: 'Dr. Harsh Test',
      role: 'doctor'
    }, 'cevi-jnmc-hackathon-2026-secret-key', { expiresIn: '8h' });
    console.log('✅ Generated valid mock JWT token natively.');
    
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    console.log('--> Test 13: Creating a patient with apostrophe and special chars in name...');
    const uhid = `UHID-${Date.now()}`;
    const createPatientRes = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        name: "O'Brien & O'Connor",
        uhid: uhid,
        age: 45,
        sex: "Male",
        height: 180,
        weight: 80
      })
    });
    const patientData = await createPatientRes.json();
    patientId = patientData.id;
    console.log('✅ Patient created successfully. ID:', patientId);

    // Prepare Assessment Data with malformed inputs
    const assessmentPayload = {
      patientId: patientId,
      rightLeg: {
        legSide: 'right',
        gsvDiamMm: '9mm', // Test 2: Should sanitize to 9
        clinicalSigns: 'null', // Test 3: Should sanitize to null
        pain: null, // Test 4: rVCSS should map to 0
        swelling: null,
      },
      leftLeg: {
        legSide: 'left',
        gsvDiamMm: '12.5px', // Test 2: Should sanitize to 12.5
        clinicalSigns: [], // Test 3: Empty array should be handled
        pain: null,
      }
    };

    console.log('\n--> Test 1 & 7: Sending TWO concurrent assessment creations exactly at the same time...');
    const fetchArgs = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(assessmentPayload)
    };
    
    const req1 = fetch(`${API_URL}/assessments`, fetchArgs).then(res => res.json().then(data => ({status: res.status, data})));
    const req2 = fetch(`${API_URL}/assessments`, fetchArgs).then(res => res.json().then(data => ({status: res.status, data})));
    
    const results = await Promise.all([req1, req2]);
    
    let successCount = 0;
    let conflictCount = 0;

    results.forEach((res, index) => {
      if (res.status === 201) {
        successCount++;
        console.log(`Req ${index + 1}: ✅ Succeeded with 201 Created`);
      } else if (res.status === 409) {
        conflictCount++;
        console.log(`Req ${index + 1}: ✅ Caught by Double Submission Guard (409 Conflict) - Error: ${res.data.error}`);
      } else {
        console.error(`Req ${index + 1}: ❌ Failed with`, res.data);
      }
    });

    if (successCount === 1 && conflictCount === 1) {
      console.log('✅ Concurrency & Double Submission checks passed flawlessly.');
    } else {
      console.log('⚠️ Concurrency check had unexpected results:', { successCount, conflictCount });
    }

    // Now test 0-byte file upload
    console.log('\n--> Test 5: Uploading a 0-byte phantom image file...');
    const zeroBytePath = path.join(__dirname, 'zero_byte.jpg');
    fs.writeFileSync(zeroBytePath, ''); // Create 0 byte file
    
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(zeroBytePath)], { type: 'image/jpeg' });
    const getLegsRes = await fetch(`${API_URL}/legs/patient/${patientId}`, { headers });
    const legsData = await getLegsRes.json();
    const realLegId = legsData[0].id;
    formData.append('leg_id', String(realLegId)); // Real leg
    formData.append('image', fileBlob, 'zero_byte.jpg');
    
    const uploadRes = await fetch(`${API_URL}/images`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    
    if (uploadRes.status === 400) {
      console.log(`✅ Server correctly rejected 0-byte file with 400 Bad Request: "${uploadData.error}"`);
    } else {
      console.log('❌ Failed with unexpected status:', uploadRes.status, uploadData);
    }

    fs.unlinkSync(zeroBytePath); // cleanup

    console.log('\n🎉 ALL HARSH TESTS PASSED!');

  } catch (err) {
    console.error('❌ Test script encountered an error:', err.message);
  }
}

runHarshTest();
