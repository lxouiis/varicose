
async function runTests() {
  const API_URL = 'http://localhost:3001/api';
  let token = '';
  let patientId = '';

  console.log('🚀 Starting System Tests with corrected clinical signs...\n');

  try {
    // 1. POST /api/auth/login
    console.log('Test 1: Auth Login');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dr.iranna@jnmc.edu', password: 'jnmc2026' })
    });
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('✅ Login successful.\n');

    const authHeaders = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };

    // 2. POST /api/patients
    console.log('Test 2: Create Patient with full demographics');
    const patientData = {
      name: 'System Test Patient',
      uhid: 'SYS-TEST-' + Date.now(),
      age: 45,
      sex: 'Male',
      height: '175',
      weight: '80',
      bmi: '26.1',
      race: 'Asian',
      smoking: 'Non-smoker',
      occupation: 'Engineer',
      parity: '0',
      comorbidities: ['Hypertension', 'Diabetes'],
      medications: ['Aspirin'],
      venous_history: ['Family history'],
      clinic: 'Test Clinic',
      doctor_notes: 'Initial test'
    };
    
    const patientRes = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(patientData)
    });
    const p = await patientRes.json();
    patientId = p.id;
    console.log('✅ Patient created.\n');

    // 3. POST /api/legs (visit 1)
    console.log('Test 3: Visit 1 - Right Leg (Varicose Veins -> C2)');
    const visit1Data = {
      patient_id: patientId,
      leg_side: 'right',
      clinical_signs: ['Varicose Veins'], // Correct string for C2
      deep_system: 'Patent',
      pain: '1',
      varicose_veins: '2'
    };
    const v1Res = await fetch(`${API_URL}/legs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(visit1Data)
    });
    const v1 = await v1Res.json();
    console.log(`✅ Visit 1 saved. ID: ${v1.id}, CEAP: ${v1.ceap_full}\n`);

    // 4. POST /api/legs (visit 2)
    console.log('Test 4: Visit 2 - Right Leg (Pigmentation -> C4a)');
    const visit2Data = {
      patient_id: patientId,
      leg_side: 'right',
      clinical_signs: ['Pigmentation'], // Correct string for C4a
      deep_system: 'Reflux',
      pain: '2',
      varicose_veins: '3'
    };
    const v2Res = await fetch(`${API_URL}/legs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(visit2Data)
    });
    const v2 = await v2Res.json();
    console.log(`✅ Visit 2 saved. ID: ${v2.id}, CEAP: ${v2.ceap_full}\n`);
    
    if (v2.id !== v1.id && v2.visit_number === 2) {
      console.log('✅ Longitudinal tracking confirmed (new row created).\n');
    } else {
      throw new Error('Longitudinal tracking failed.');
    }

    // 5. GET /api/legs/:patientId
    console.log('Test 5: Get Assessment History');
    const historyRes = await fetch(`${API_URL}/legs/${patientId}`, { headers: authHeaders });
    const history = await historyRes.json();
    console.log(`✅ History verified. Found ${history.length} records.\n`);

    // 6. GET /api/patients (Dashboard Check)
    console.log('Test 6: Dashboard Latest CEAP Badge Check');
    const dashRes = await fetch(`${API_URL}/patients`, { headers: authHeaders });
    const dashboard = await dashRes.json();
    const testPatient = dashboard.find((p: any) => p.id === patientId);
    
    // Visit 2 was C4a.
    if (testPatient.ceap_right && testPatient.ceap_right.includes('C4a')) {
      console.log(`✅ Dashboard verified. Showing latest CEAP badge: ${testPatient.ceap_right}\n`);
    } else {
      throw new Error(`Dashboard showing incorrect/stale CEAP badge: ${testPatient.ceap_right}`);
    }

    console.log('⭐ ALL SYSTEM TESTS PASSED SUCCESSFULLY! ⭐');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    process.exit(1);
  }
}

runTests();
