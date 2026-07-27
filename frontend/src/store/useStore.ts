import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import type { DopplerSlotImage } from '../components/ui/doppler-upload';

export type Gender = 'Male' | 'Female' | 'Other';
export type DeepSystem = 'Patent' | 'DVT' | 'Post-thrombotic';

export interface Patient {
  id: string;
  patientName: string;
  uhid: string;
  age: number;
  gender: Gender;
  createdAt: string;
  ceapGrade?: string;
  ceapRight?: string;
  ceapLeft?: string;
  rvcssTotal?: number;
  // Extended demographics
  height?: number;
  weight?: number;
  bmi?: string;
  ethnicity?: string;
  smokingStatus?: string[];
  occupationType?: string[];
  comorbidities?: string[];
  venousHistory?: string[];
  parity?: number;
  currentMedications?: string[];
  clinicalNotes?: string;
  rightPainVas?: number;
  leftPainVas?: number;
  veinesNotes?: string;
}

export interface LegExam {
  skin: string;
  swelling: number; // 0-3
  ulcerPresent: boolean;
  ulcerLocationText?: string; 
  ulcerSizeCm?: number;     
  ulcerType?: string;      
  ulcerEdges?: string;     
  ulcerBase?: string;      
  tenderness: boolean;
  varicosities: string[]; 
  
  // Section 4 — Doppler
  deepSystem: DeepSystem;  
  sfjReflux: boolean;
  gsvDiamMm: number;
  ssvDiamMm?: number;      
  incompetentPerforators: boolean;
  clinicalSigns: string[];
  commonFemoralVein?: string;    
  superficialFemoralVein?: string;
  poplitealVeinStatus?: string;  
  etiology?: string;             
  
  // Section 5 rVCSS (0-3)
  pain: number;
  varicoseVeins: number;
  venousEdema: number;
  skinPigmentation: number;
  inflammation: number;
  induration: number;
  ulcerNumber: number;
  ulcerDuration: number;
  ulcerSizeScore: number;
  compressionCompliance: number;

  // Computed
  ceapTotal: string;
  rvcssTotal: number;
}


const safeJsonParse = (val: any): any => {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return [val]; }
};

const mapPatientFromBackend = (p: any): Patient => ({
  id: p.id,
  patientName: p.name,
  uhid: p.uhid,
  age: p.age,
  gender: p.sex,
  createdAt: p.created_at,
  ceapGrade: p.ceap_full,
  ceapRight: p.ceap_right || null,
  ceapLeft: p.ceap_left || null,
  rvcssTotal: p.rvcss_total ?? 0,
  height: p.height,
  weight: p.weight,
  bmi: p.bmi?.toString(),
  ethnicity: p.race,
  smokingStatus: safeJsonParse(p.smoking),
  occupationType: safeJsonParse(p.occupation),
  parity: p.parity,
  comorbidities: safeJsonParse(p.comorbidities),
  venousHistory: safeJsonParse(p.venous_history),
  currentMedications: safeJsonParse(p.medications),
  clinicalNotes: p.clinical_notes,
  rightPainVas: p.r_pain_vas,
  leftPainVas: p.l_pain_vas,
  veinesNotes: p.veines_notes,
});

const initialLegState: LegExam = {
  skin: 'Normal',
  swelling: 0,
  ulcerPresent: false,
  tenderness: false,
  varicosities: [],
  deepSystem: 'Patent',
  sfjReflux: false,
  gsvDiamMm: 0,
  incompetentPerforators: false,
  clinicalSigns: [],
  pain: 0,
  varicoseVeins: 0,
  venousEdema: 0,
  skinPigmentation: 0,
  inflammation: 0,
  induration: 0,
  ulcerNumber: 0,
  ulcerDuration: 0,
  ulcerSizeScore: 0,
  compressionCompliance: 0,
  ceapTotal: 'C0, Ep, An, Pn',
  rvcssTotal: 0,
};

export interface Assessment {
  id: string;
  patientId: string;
  assessedBy: string;
  assessmentDate: string;
  
  comorbidities: string[];
  venousHistory: string[];
  medicationHistory: string;
  clinicalNotes?: string;  
  
  bloodPressure: string;
  pulseRate: number;
  generalSigns: string[];
  pedalEdemaBilateral: boolean;
  lymphadenopathy: boolean;
  
  rightLeg: LegExam;
  leftLeg: LegExam;
  
  rightPainVas?: number;
  leftPainVas?: number;
  veinesNotes?: string;
  dopplerImages?: Omit<DopplerSlotImage, 'file'>[]; // clinical slot data without file blobs

  globalRvcssTotal: number;
  createdAt: string;
}

export interface AuthUser {
  email: string;
  name: string;
  role: string;
}

interface CeviState {
  patients: Patient[];
  assessments: Assessment[];
  token: string | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  
  // Auth
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  
  // API Actions
  fetchPatients: () => Promise<void>;
  addPatient: (patient: Partial<Patient>) => Promise<string | null>;
  updatePatient: (id: string, patient: Partial<Patient>) => Promise<void>;
  addAssessment: (assessment: any) => Promise<any>;
  fetchAssessments: (patientId: string) => Promise<void>;
  
  // Getters
  getPatientById: (id: string) => Patient | undefined;
  getAssessmentsByPatientId: (patientId: string) => Assessment[];
  isUhidTaken: (uhid: string) => boolean;
  getTodayAssessment: (patientId: string) => Assessment | undefined;
  
  auditData: () => void;
  seedData: () => void;
}

export const useStore = create<CeviState>()(
  persist(
    (set, get) => ({
      patients: [],
      assessments: [],
      isAuthenticated: false,
      currentUser: null,
      token: null,

      login: async (email, password) => {
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user } = res.data;
          set({ isAuthenticated: true, currentUser: user, token });
          return true;
        } catch (error) {
          console.error('Login failed:', error);
          return false;
        }
      },

      logout: () => set({ 
        isAuthenticated: false, 
        currentUser: null, 
        token: null, 
        patients: [], 
        assessments: [] 
      }),

      fetchPatients: async () => {
        try {
          const res = await api.get('/patients');
          // Map backend fields (name, sex, created_at) to frontend fields (patientName, gender, createdAt)
          const mapped = res.data.map(mapPatientFromBackend);
          set({ patients: mapped });
        } catch (error) {
          console.error('Fetch patients failed:', error);
        }
      },

      addPatient: async (patient) => {
        try {
          // Map frontend fields to backend fields
          const payload = {
            name: patient.patientName,
            uhid: patient.uhid,
            age: patient.age,
            sex: patient.gender,
            height: patient.height,
            weight: patient.weight,
            bmi: patient.bmi,
            race: patient.ethnicity,
            smoking: patient.smokingStatus && patient.smokingStatus.length > 0 ? JSON.stringify(patient.smokingStatus) : undefined,
            occupation: patient.occupationType && patient.occupationType.length > 0 ? JSON.stringify(patient.occupationType) : undefined,
            parity: patient.parity,
            comorbidities: patient.comorbidities && patient.comorbidities.length > 0 ? JSON.stringify(patient.comorbidities) : undefined,
            venous_history: patient.venousHistory && patient.venousHistory.length > 0 ? JSON.stringify(patient.venousHistory) : undefined,
            medications: patient.currentMedications && patient.currentMedications.length > 0 ? JSON.stringify(patient.currentMedications) : undefined,
            clinical_notes: patient.clinicalNotes,
            r_pain_vas: patient.rightPainVas,
            l_pain_vas: patient.leftPainVas,
            veines_notes: patient.veinesNotes,
          };
          const res = await api.post('/patients', payload);
          // Map response back to frontend format
          const mapped = mapPatientFromBackend(res.data);
          set((state) => ({ patients: [mapped as Patient, ...state.patients] }));
          return res.data.id;
        } catch (error: any) {
          console.error('Add patient failed:', error.response?.data || error.message);
          throw new Error(error.response?.data?.error || error.message || 'Failed to add patient');
        }
      },

      updatePatient: async (id, data) => {
        try {
          // Map frontend fields to backend fields (same mapping as addPatient)
          const payload: Record<string, any> = {};
          if (data.patientName !== undefined) payload.name = data.patientName;
          if (data.age !== undefined) payload.age = data.age;
          if (data.gender !== undefined) payload.sex = data.gender;
          if (data.height !== undefined) payload.height = data.height;
          if (data.weight !== undefined) payload.weight = data.weight;
          if (data.bmi !== undefined) payload.bmi = data.bmi;
          if (data.ethnicity !== undefined) payload.race = data.ethnicity;
          if (data.smokingStatus !== undefined) payload.smoking = data.smokingStatus && data.smokingStatus.length > 0 ? JSON.stringify(data.smokingStatus) : null;
          if (data.occupationType !== undefined) payload.occupation = data.occupationType && data.occupationType.length > 0 ? JSON.stringify(data.occupationType) : null;
          if (data.parity !== undefined) payload.parity = data.parity;
          if (data.comorbidities !== undefined) payload.comorbidities = data.comorbidities && data.comorbidities.length > 0 ? JSON.stringify(data.comorbidities) : null;
          if (data.venousHistory !== undefined) payload.venous_history = data.venousHistory && data.venousHistory.length > 0 ? JSON.stringify(data.venousHistory) : null;
          if (data.currentMedications !== undefined) payload.medications = data.currentMedications && data.currentMedications.length > 0 ? JSON.stringify(data.currentMedications) : null;
          if (data.clinicalNotes !== undefined) payload.clinical_notes = data.clinicalNotes;
          if (data.rightPainVas !== undefined) payload.r_pain_vas = data.rightPainVas;
          if (data.leftPainVas !== undefined) payload.l_pain_vas = data.leftPainVas;
          if (data.veinesNotes !== undefined) payload.veines_notes = data.veinesNotes;

          const res = await api.put(`/patients/${id}`, payload);
          set((state) => ({ patients: state.patients.map((p) => p.id === id ? mapPatientFromBackend(res.data) : p) }));
        } catch (error) {
          console.error('Update patient failed:', error);
        }
      },

      fetchAssessments: async (patientId) => {
        try {
          const res = await api.get(`/assessments/${patientId}`);
          const backendAssessments = res.data;
          
          if (!backendAssessments || backendAssessments.length === 0) {
            set((state) => ({ assessments: state.assessments.filter(a => a.patientId !== patientId) }));
            return;
          }

          const mappedAssessments = backendAssessments.map((ba: any) => {
            const legs = ba.legs || [];
            const rightLeg = legs.find((l: any) => l.leg_side === 'right');
            const leftLeg = legs.find((l: any) => l.leg_side === 'left');

            return {
              id: ba.id,
              patientId: ba.patient_id,
              assessedBy: ba.assessed_by || 'Unknown',
              assessmentDate: ba.assessment_date.split('T')[0],
              comorbidities: ba.comorbidities ? JSON.parse(ba.comorbidities) : [],
              venousHistory: ba.venous_history ? JSON.parse(ba.venous_history) : [],
              medicationHistory: '', // Derived from patient if needed
              bloodPressure: ba.blood_pressure || '',
              pulseRate: ba.pulse_rate || 0,
              generalSigns: ba.general_signs ? JSON.parse(ba.general_signs) : [],
              pedalEdemaBilateral: false,
              lymphadenopathy: false,
              clinicalNotes: ba.clinical_notes || '',
              rightPainVas: ba.right_pain_vas || rightLeg?.pain_vas || 0,
              leftPainVas: ba.left_pain_vas || leftLeg?.pain_vas || 0,
              veinesNotes: ba.veines_notes || '',
              rightLeg: rightLeg ? {
                ...rightLeg,
                // Doppler — camelCase remaps
                deepSystem: rightLeg.deep_system || 'Patent',
                gsvDiamMm: rightLeg.gsv_diameter,
                ssvDiamMm: rightLeg.ssv_diameter,
                gsvReflux: rightLeg.gsv_reflux || false,
                ssvReflux: rightLeg.ssv_reflux || false,
                incompetentPerforators: rightLeg.incompetent_perforators,
                commonFemoralVein: rightLeg.common_femoral_vein,
                superficialFemoralVein: rightLeg.superficial_femoral_vein,
                poplitealVeinStatus: rightLeg.popliteal_vein,
                sfjReflux: rightLeg.sfj_reflux,
                clinicalSigns: (() => { try { return JSON.parse(rightLeg.clinical_signs || '[]'); } catch { return []; } })(),
                etiology: rightLeg.etiology || '',
                // rVCSS — name differs between DB and LegExam
                pain: rightLeg.pain || 0,
                varicoseVeins: rightLeg.varicose_veins || 0,
                venousEdema: rightLeg.edema || 0,
                skinPigmentation: rightLeg.pigmentation || 0,
                inflammation: rightLeg.inflammation || 0,
                induration: rightLeg.induration || 0,
                ulcerNumber: rightLeg.ulcer_count || 0,
                ulcerDuration: rightLeg.ulcer_duration || 0,
                ulcerSizeScore: rightLeg.ulcer_size || 0,
                compressionCompliance: rightLeg.compression || 0,
                // CEAP + totals
                ceapTotal: rightLeg.ceap_full,
                rvcssTotal: rightLeg.rvcss_total,
                // Ulcer details
                ulcerPresent: rightLeg.ulcer_present,
                ulcerLocationText: rightLeg.ulcer_location,
                ulcerSizeCm: rightLeg.ulcer_size_cm,
                ulcerType: rightLeg.ulcer_type,
                ulcerEdges: rightLeg.ulcer_edges,
                ulcerBase: rightLeg.ulcer_base,
                // Skin & swelling
                skin: rightLeg.skin_changes,
                swelling: rightLeg.swelling_grade ? parseInt(rightLeg.swelling_grade) : 0,
                // Not stored in DB — provide defaults
                tenderness: false,
                varicosities: [],
              } : initialLegState,
              leftLeg: leftLeg ? {
                ...leftLeg,
                // Doppler — camelCase remaps
                deepSystem: leftLeg.deep_system || 'Patent',
                gsvDiamMm: leftLeg.gsv_diameter,
                ssvDiamMm: leftLeg.ssv_diameter,
                gsvReflux: leftLeg.gsv_reflux || false,
                ssvReflux: leftLeg.ssv_reflux || false,
                incompetentPerforators: leftLeg.incompetent_perforators,
                commonFemoralVein: leftLeg.common_femoral_vein,
                superficialFemoralVein: leftLeg.superficial_femoral_vein,
                poplitealVeinStatus: leftLeg.popliteal_vein,
                sfjReflux: leftLeg.sfj_reflux,
                clinicalSigns: (() => { try { return JSON.parse(leftLeg.clinical_signs || '[]'); } catch { return []; } })(),
                etiology: leftLeg.etiology || '',
                // rVCSS — name differs between DB and LegExam
                pain: leftLeg.pain || 0,
                varicoseVeins: leftLeg.varicose_veins || 0,
                venousEdema: leftLeg.edema || 0,
                skinPigmentation: leftLeg.pigmentation || 0,
                inflammation: leftLeg.inflammation || 0,
                induration: leftLeg.induration || 0,
                ulcerNumber: leftLeg.ulcer_count || 0,
                ulcerDuration: leftLeg.ulcer_duration || 0,
                ulcerSizeScore: leftLeg.ulcer_size || 0,
                compressionCompliance: leftLeg.compression || 0,
                // CEAP + totals
                ceapTotal: leftLeg.ceap_full,
                rvcssTotal: leftLeg.rvcss_total,
                // Ulcer details
                ulcerPresent: leftLeg.ulcer_present,
                ulcerLocationText: leftLeg.ulcer_location,
                ulcerSizeCm: leftLeg.ulcer_size_cm,
                ulcerType: leftLeg.ulcer_type,
                ulcerEdges: leftLeg.ulcer_edges,
                ulcerBase: leftLeg.ulcer_base,
                // Skin & swelling
                skin: leftLeg.skin_changes,
                swelling: leftLeg.swelling_grade ? parseInt(leftLeg.swelling_grade) : 0,
                // Not stored in DB — provide defaults
                tenderness: false,
                varicosities: [],
              } : initialLegState,
              globalRvcssTotal: ba.global_rvcss,
              createdAt: ba.assessment_date,
              dopplerImages: [
                ...(rightLeg?.dopplerImages || []).map((d: any) => ({
                  id: d.id,
                  leg: 'right',
                  phase: d.phase,
                  segment: d.segment,
                  view: d.view_type,
                  compressible: d.compressible,
                  spontaneousFlow: d.spontaneous_flow,
                  refluxMs: d.reflux_ms,
                  refluxPositive: d.reflux_positive,
                  diameterMm: d.diameter_mm,
                  outwardFlow: d.outward_flow,
                  filePath: d.file_path,
                  fileName: d.file_name || d.file_path?.split('/').pop() || '',
                  previewUrl: d.file_path ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}/${d.file_path}` : undefined,
                })),
                ...(leftLeg?.dopplerImages || []).map((d: any) => ({
                  id: d.id,
                  leg: 'left',
                  phase: d.phase,
                  segment: d.segment,
                  view: d.view_type,
                  compressible: d.compressible,
                  spontaneousFlow: d.spontaneous_flow,
                  refluxMs: d.reflux_ms,
                  refluxPositive: d.reflux_positive,
                  diameterMm: d.diameter_mm,
                  outwardFlow: d.outward_flow,
                  filePath: d.file_path,
                  fileName: d.file_name || d.file_path?.split('/').pop() || '',
                  previewUrl: d.file_path ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}/${d.file_path}` : undefined,
                }))
              ],
            };
          });

          set((state) => ({
            assessments: state.assessments.filter(a => a.patientId !== patientId).concat(mappedAssessments)
          }));
        } catch (error) {
          console.error('Fetch assessments failed:', error);
        }
      },

      addAssessment: async (assessment) => {
        try {
          const payload = {
            patientId: assessment.patientId,
            comorbidities: assessment.comorbidities,
            venousHistory: assessment.venousHistory,
            clinicalNotes: assessment.clinicalNotes,
            rightPainVas: assessment.rightPainVas,
            leftPainVas: assessment.leftPainVas,
            veinesNotes: assessment.veinesNotes,
            rightLeg: { ...assessment.rightLeg, pain_vas: assessment.rightPainVas },
            leftLeg: { ...assessment.leftLeg, pain_vas: assessment.leftPainVas }
          };

          const res = await api.post('/assessments', payload);
          const assessmentData = res.data;

          await get().fetchAssessments(assessment.patientId);

          // Merge doppler images into the newly created assessment in the store
          if (assessment.dopplerImages?.length) {
            set((state) => ({
              assessments: state.assessments.map((a) =>
                a.id === assessmentData.id
                  ? { ...a, dopplerImages: assessment.dopplerImages }
                  : a
              )
            }));
          }

          return assessmentData; 
        } catch (error) {
          console.error('Add assessment failed:', error);
          throw error;
        }
      },

      getPatientById: (id) => get().patients.find(p => p.id === id),
      getAssessmentsByPatientId: (patientId) => get().assessments.filter(a => a.patientId === patientId),
      isUhidTaken: (uhid) => get().patients.some(p => p.uhid.toLowerCase() === uhid.toLowerCase()),
      getTodayAssessment: (patientId) => {
        const today = new Date().toISOString().split('T')[0];
        return get().assessments.find(a => a.patientId === patientId && a.assessmentDate === today);
      },

      auditData: () => {
        const { patients, assessments } = get();
        console.group('%c🔍 CEVI Data Audit', 'font-weight:bold;font-size:14px;color:#1a6b5c');
        console.log('Total patients:', patients.length);
        console.log('Total assessments:', assessments.length);
        console.groupEnd();
      },

      seedData: () => {
        // Legacy seed logic - mostly unused now that we have a real backend
        console.log('Seed logic disabled for API-backed store');
      }
    }),
    {
      name: 'cevi-auth',
      partialize: (state) => ({ 
        token: state.token, 
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
