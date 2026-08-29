import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import type { DopplerSlotImage } from '../components/ui/doppler-upload';

export type Gender = 'Male' | 'Female' | 'Other';
export type DeepSystem = 'Patent' | 'DVT' | 'Post-thrombotic';

/**
 * Patient — static demographics only (v2 normalized schema).
 *
 * Per-visit fields (comorbidities, medications, venous_history, clinical_notes,
 * veines_notes, rightPainVas, leftPainVas) have been MOVED to Assessment.
 * Patient now represents stable, slowly-changing information about the person.
 */
export interface Patient {
  id: string;
  patientName: string;
  uhid: string;
  age: number;
  gender: Gender;
  createdAt: string;
  // Computed from latest legs (derived on-the-fly from CEAP components)
  ceapGrade?: string;
  ceapRight?: string;
  ceapLeft?: string;
  rvcssTotal?: number;
  // Demographics
  height?: number;
  weight?: number;
  bmi?: string;
  ethnicity?: string;
  smokingStatus?: string[];
  occupationType?: string[];
  dvtHistory?: boolean;
  clinic?: string;
  doctorNotes?: string;
  parity?: number;
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

  // Section 4 — Doppler (UI-only; these fields are NOT stored on the Leg table
  // in v2 — they live in DopplerImage. However they are kept here for the
  // form and report display to remain functional.)
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

  // Section 5 — rVCSS scores (0-3 each; stored individually on Leg)
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

  // Computed (derived on-the-fly — NOT stored in DB columns)
  ceapTotal: string;
  rvcssTotal: number;

  // Patient-reported pain VAS (Float, per-leg)
  pain_vas?: number;
}

const safeJsonParse = (val: any): any => {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return [val]; }
};

/** Map a Patient API response to the frontend Patient interface */
const mapPatientFromBackend = (p: any): Patient => ({
  id:             p.id,
  patientName:    p.name,
  uhid:           p.uhid,
  age:            p.age,
  gender:         p.sex,
  createdAt:      p.created_at,
  // Computed CEAP fields (derived server-side from component fields)
  ceapGrade:      p.ceap_full   || null,
  ceapRight:      p.ceap_right  || null,
  ceapLeft:       p.ceap_left   || null,
  rvcssTotal:     p.rvcss_total ?? 0,
  // Demographics
  height:         p.height,
  weight:         p.weight,
  bmi:            p.bmi?.toString(),
  ethnicity:      p.race,
  smokingStatus:  safeJsonParse(p.smoking),
  occupationType: safeJsonParse(p.occupation),
  dvtHistory:     p.dvt_history,
  clinic:         p.clinic,
  doctorNotes:    p.doctor_notes,
  parity:         p.parity,
  // NOTE: comorbidities, venousHistory, currentMedications, clinicalNotes,
  // veinesNotes, rightPainVas, leftPainVas are NO LONGER on Patient.
  // They are fetched per-assessment via fetchAssessments().
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
  ceapTotal: 'C0, En, An, Pn',
  rvcssTotal: 0,
};

/**
 * Assessment — represents one visit to the clinic (v2 normalized schema).
 *
 * Per-visit fields (comorbidities, medications, venous_history, clinical_notes,
 * veines_notes) have been MOVED here from Patient.
 * bp, pulse, general_signs are now properly saved (previously silently dropped).
 */
export interface Assessment {
  id: string;
  patientId: string;
  assessedBy: string;
  assessmentDate: string;

  // Per-visit history (moved from Patient)
  comorbidities: string[];
  venousHistory: string[];
  medications: string[];
  clinicalNotes?: string;
  veinesNotes?: string;

  // General Physical Examination (previously silently dropped — now saved)
  bloodPressure: string;
  pulseRate: number;
  generalSigns: string[];

  rightLeg: LegExam;
  leftLeg: LegExam;

  // Pain VAS lives on individual legs in v2 (Leg.pain_vas)
  rightPainVas?: number;
  leftPainVas?: number;

  dopplerImages?: Omit<DopplerSlotImage, 'file'>[]; // clinical slot data (no file blobs)

  globalRvcssTotal: number;
  createdAt: string;
}

export interface AuthUser {
  email: string;
  name: string;
  role: string;
  mustResetPassword: boolean;
}

export interface DoctorAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  mustResetPassword: boolean;
  createdAt: string;
}

interface CeviState {
  patients: Patient[];
  assessments: Assessment[];
  token: string | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  doctors: DoctorAccount[];

  // Auth
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  // Admin
  fetchDoctors: () => Promise<void>;
  resetDoctorPassword: (doctorId: number) => Promise<{ tempPassword: string } | { error: string }>;

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
      doctors: [],

      login: async (email, password) => {
        try {
          const res = await api.post('/auth/login', { email, password });
          const { token, user, mustResetPassword } = res.data;
          set({ isAuthenticated: true, currentUser: { ...user, mustResetPassword }, token });
          return { success: true };
        } catch (error: any) {
          console.error('Login failed:', error);
          // Surface what actually went wrong instead of a one-size-fits-all
          // message — "can't reach the server" and "wrong password" need
          // very different fixes, and hiding that distinction is what made
          // this hard to diagnose.
          let message: string;
          if (error?.response?.data?.error) {
            // A real response from the server — its message (e.g. "Invalid
            // email or password", or the rate limiter's message) is already
            // client-safe.
            message = error.response.data.error;
          } else if (error?.request) {
            // Request went out but no response came back at all — the
            // backend isn't reachable at the configured API URL (not
            // running, wrong port, CORS blocked it, etc.), not a bad
            // password.
            message = `Can't reach the server at ${api.defaults.baseURL}. Is the backend running?`;
          } else {
            message = 'Unexpected error while logging in.';
          }
          return { success: false, error: message };
        }
      },

      logout: () => set({
        isAuthenticated: false,
        currentUser: null,
        token: null,
        patients: [],
        assessments: [],
        doctors: [],
      }),

      changePassword: async (currentPassword, newPassword) => {
        try {
          await api.post('/auth/change-password', { currentPassword, newPassword });
          // The password is now set — clear the forced-reset flag so Layout
          // stops redirecting to /reset-password.
          set(state => ({
            currentUser: state.currentUser ? { ...state.currentUser, mustResetPassword: false } : null,
          }));
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error?.response?.data?.error || 'Failed to change password' };
        }
      },

      fetchDoctors: async () => {
        try {
          const res = await api.get('/admin/doctors');
          set({ doctors: res.data });
        } catch (error) {
          console.error('Fetch doctors failed:', error);
        }
      },

      resetDoctorPassword: async (doctorId) => {
        try {
          const res = await api.post(`/admin/doctors/${doctorId}/reset-password`);
          // Refresh the list so the "reset required" status shown for this
          // doctor updates immediately.
          await get().fetchDoctors();
          return { tempPassword: res.data.tempPassword };
        } catch (error: any) {
          return { error: error?.response?.data?.error || 'Failed to reset password' };
        }
      },

      fetchPatients: async () => {
        try {
          const res = await api.get('/patients');
          const mapped = res.data.map(mapPatientFromBackend);
          set({ patients: mapped });
        } catch (error) {
          console.error('Fetch patients failed:', error);
        }
      },

      addPatient: async (patient) => {
        try {
          // v2: Only send static demographic fields to Patient.
          // Per-visit fields (comorbidities, medications, venous_history, etc.)
          // must be sent with addAssessment(), NOT here.
          // NOTE: uhid is NOT sent — the server always generates it (see
          // backend/src/utils/uhid.ts) so concurrent registrations can never collide.
          const payload = {
            name:       patient.patientName,
            age:        patient.age,
            sex:        patient.gender,
            height:     patient.height,
            weight:     patient.weight,
            bmi:        patient.bmi,
            race:       patient.ethnicity,
            smoking:    patient.smokingStatus  && patient.smokingStatus.length  > 0 ? JSON.stringify(patient.smokingStatus)  : undefined,
            occupation: patient.occupationType && patient.occupationType.length > 0 ? JSON.stringify(patient.occupationType) : undefined,
            parity:     patient.parity,
            dvt_history: patient.dvtHistory,
            clinic:      patient.clinic,
            doctor_notes: patient.doctorNotes,
          };
          const res = await api.post('/patients', payload);
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
          // v2: Only update static demographic fields on Patient.
          const payload: Record<string, any> = {};
          if (data.patientName   !== undefined) payload.name         = data.patientName;
          if (data.age           !== undefined) payload.age          = data.age;
          if (data.gender        !== undefined) payload.sex          = data.gender;
          if (data.height        !== undefined) payload.height       = data.height;
          if (data.weight        !== undefined) payload.weight       = data.weight;
          if (data.bmi           !== undefined) payload.bmi          = data.bmi;
          if (data.ethnicity     !== undefined) payload.race         = data.ethnicity;
          if (data.smokingStatus !== undefined) payload.smoking      = data.smokingStatus    && data.smokingStatus.length    > 0 ? JSON.stringify(data.smokingStatus)    : null;
          if (data.occupationType !== undefined) payload.occupation  = data.occupationType   && data.occupationType.length   > 0 ? JSON.stringify(data.occupationType)   : null;
          if (data.parity        !== undefined) payload.parity       = data.parity;
          if (data.dvtHistory    !== undefined) payload.dvt_history  = data.dvtHistory;
          if (data.clinic        !== undefined) payload.clinic       = data.clinic;
          if (data.doctorNotes   !== undefined) payload.doctor_notes = data.doctorNotes;

          const res = await api.put(`/patients/${id}`, payload);
          set((state) => ({
            patients: state.patients.map((p) => p.id === id ? mapPatientFromBackend(res.data) : p),
          }));
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
            const leftLeg  = legs.find((l: any) => l.leg_side === 'left');

            return {
              id:             ba.id,
              patientId:      ba.patient_id,
              assessedBy:     ba.doctor?.name || 'Unknown',
              assessmentDate: ba.assessment_date.split('T')[0],

              // Per-visit history (now on Assessment, not Patient)
              comorbidities:  ba.comorbidities  ? JSON.parse(ba.comorbidities)  : [],
              venousHistory:  ba.venous_history  ? JSON.parse(ba.venous_history) : [],
              medications:    ba.medications     ? JSON.parse(ba.medications)    : [],
              clinicalNotes:  ba.clinical_notes  || '',
              veinesNotes:    ba.veines_notes    || '',

              // General exam — NOW properly saved (fixing silent data loss)
              bloodPressure: ba.bp    || '',
              pulseRate:     ba.pulse || 0,
              generalSigns:  ba.general_signs ? JSON.parse(ba.general_signs) : [],

              // Pain VAS from legs (per-leg, Float)
              rightPainVas: rightLeg?.pain_vas ?? 0,
              leftPainVas:  leftLeg?.pain_vas  ?? 0,

              rightLeg: rightLeg ? {
                ...rightLeg,
                // Doppler — UI fields (not stored in DB v2; kept for report display)
                deepSystem:            rightLeg.deep_system           || 'Patent',
                gsvDiamMm:             rightLeg.gsv_diameter          || 0,
                ssvDiamMm:             rightLeg.ssv_diameter          || 0,
                gsvReflux:             rightLeg.gsv_reflux            || false,
                ssvReflux:             rightLeg.ssv_reflux            || false,
                incompetentPerforators: rightLeg.incompetent_perforators || false,
                commonFemoralVein:     rightLeg.common_femoral_vein   || '',
                superficialFemoralVein: rightLeg.superficial_femoral_vein || '',
                poplitealVeinStatus:   rightLeg.popliteal_vein        || '',
                sfjReflux:             rightLeg.sfj_reflux            || false,
                clinicalSigns:         (() => { try { return JSON.parse(rightLeg.clinical_signs || '[]'); } catch { return []; } })(),
                etiology:              rightLeg.ceap_e  || '',
                // rVCSS — name remapping (DB snake_case → LegExam camelCase)
                pain:                  rightLeg.pain                  || 0,
                varicoseVeins:         rightLeg.varicose_veins        || 0,
                venousEdema:           rightLeg.edema                 || 0,
                skinPigmentation:      rightLeg.pigmentation          || 0,
                inflammation:          rightLeg.inflammation          || 0,
                induration:            rightLeg.induration            || 0,
                ulcerNumber:           rightLeg.ulcer_count           || 0,
                ulcerDuration:         rightLeg.ulcer_duration        || 0,
                ulcerSizeScore:        rightLeg.ulcer_size            || 0,
                compressionCompliance: rightLeg.compression           || 0,
                // Computed (now provided by backend decorator)
                ceapTotal:  rightLeg.ceap_full,
                rvcssTotal: rightLeg.rvcss_total,
                // Ulcer details
                ulcerPresent:      rightLeg.ulcer_present,
                ulcerLocationText: rightLeg.ulcer_location,
                ulcerSizeCm:       rightLeg.ulcer_size_cm,
                ulcerType:         rightLeg.ulcer_type,
                ulcerEdges:        rightLeg.ulcer_edges,
                ulcerBase:         rightLeg.ulcer_base,
                // Skin & swelling
                skin:     rightLeg.skin_changes,
                swelling: rightLeg.swelling_grade ?? 0,
                // VAS
                pain_vas: rightLeg.pain_vas,
                // UI defaults
                tenderness:   false,
                varicosities: [],
              } : initialLegState,

              leftLeg: leftLeg ? {
                ...leftLeg,
                deepSystem:            leftLeg.deep_system            || 'Patent',
                gsvDiamMm:             leftLeg.gsv_diameter           || 0,
                ssvDiamMm:             leftLeg.ssv_diameter           || 0,
                gsvReflux:             leftLeg.gsv_reflux             || false,
                ssvReflux:             leftLeg.ssv_reflux             || false,
                incompetentPerforators: leftLeg.incompetent_perforators || false,
                commonFemoralVein:     leftLeg.common_femoral_vein    || '',
                superficialFemoralVein: leftLeg.superficial_femoral_vein || '',
                poplitealVeinStatus:   leftLeg.popliteal_vein         || '',
                sfjReflux:             leftLeg.sfj_reflux             || false,
                clinicalSigns:         (() => { try { return JSON.parse(leftLeg.clinical_signs  || '[]'); } catch { return []; } })(),
                etiology:              leftLeg.ceap_e   || '',
                pain:                  leftLeg.pain                   || 0,
                varicoseVeins:         leftLeg.varicose_veins         || 0,
                venousEdema:           leftLeg.edema                  || 0,
                skinPigmentation:      leftLeg.pigmentation           || 0,
                inflammation:          leftLeg.inflammation           || 0,
                induration:            leftLeg.induration             || 0,
                ulcerNumber:           leftLeg.ulcer_count            || 0,
                ulcerDuration:         leftLeg.ulcer_duration         || 0,
                ulcerSizeScore:        leftLeg.ulcer_size             || 0,
                compressionCompliance: leftLeg.compression            || 0,
                ceapTotal:  leftLeg.ceap_full,
                rvcssTotal: leftLeg.rvcss_total,
                ulcerPresent:      leftLeg.ulcer_present,
                ulcerLocationText: leftLeg.ulcer_location,
                ulcerSizeCm:       leftLeg.ulcer_size_cm,
                ulcerType:         leftLeg.ulcer_type,
                ulcerEdges:        leftLeg.ulcer_edges,
                ulcerBase:         leftLeg.ulcer_base,
                skin:     leftLeg.skin_changes,
                swelling: leftLeg.swelling_grade ?? 0,
                pain_vas: leftLeg.pain_vas,
                tenderness:   false,
                varicosities: [],
              } : initialLegState,

              globalRvcssTotal: (rightLeg?.rvcss_total || 0) + (leftLeg?.rvcss_total || 0),
              createdAt: ba.assessment_date,

              dopplerImages: [
                ...(rightLeg?.dopplerImages || []).map((d: any) => ({
                  id:           d.id,
                  leg:          'right',
                  phase:        d.phase,
                  segment:      d.segment,
                  view:         d.view_type,
                  veinStatus:   d.vein_status,
                  compressible: d.compressible,
                  spontaneous:  d.spontaneous_flow,
                  refluxMs:     d.reflux_ms,
                  refluxPositive: d.reflux_positive,
                  diameterMm:   d.diameter_mm,
                  outwardFlow350: d.outward_flow,
                  filePath:     d.file_path,
                  fileName:     d.file_name || d.file_path?.split('/').pop() || '',
                  previewUrl:   d.file_path ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}/${d.file_path}` : undefined,
                })),
                ...(leftLeg?.dopplerImages || []).map((d: any) => ({
                  id:           d.id,
                  leg:          'left',
                  phase:        d.phase,
                  segment:      d.segment,
                  view:         d.view_type,
                  veinStatus:   d.vein_status,
                  compressible: d.compressible,
                  spontaneous:  d.spontaneous_flow,
                  refluxMs:     d.reflux_ms,
                  refluxPositive: d.reflux_positive,
                  diameterMm:   d.diameter_mm,
                  outwardFlow350: d.outward_flow,
                  filePath:     d.file_path,
                  fileName:     d.file_name || d.file_path?.split('/').pop() || '',
                  previewUrl:   d.file_path ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}/${d.file_path}` : undefined,
                })),
              ],
            };
          });

          set((state) => ({
            assessments: state.assessments
              .filter(a => a.patientId !== patientId)
              .concat(mappedAssessments),
          }));
        } catch (error) {
          console.error('Fetch assessments failed:', error);
        }
      },

      addAssessment: async (assessment) => {
        try {
          // v2 payload — per-visit fields now go to Assessment (not Patient)
          const payload = {
            patientId:     assessment.patientId,
            // Per-visit history (moved from Patient)
            comorbidities: assessment.comorbidities,
            venousHistory:  assessment.venousHistory,
            medications:   assessment.medications,
            clinicalNotes: assessment.clinicalNotes,
            veinesNotes:   assessment.veinesNotes,
            // General exam — NOW included (fixing silent data loss)
            bp:            assessment.bp,
            pulse:         assessment.pulse,
            generalSigns:  assessment.generalSigns,
            // Legs (pain_vas per-leg via leg objects)
            rightLeg: { ...assessment.rightLeg, pain_vas: assessment.rightPainVas },
            leftLeg:  { ...assessment.leftLeg,  pain_vas: assessment.leftPainVas  },
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
              ),
            }));
          }

          return assessmentData;
        } catch (error) {
          console.error('Add assessment failed:', error);
          throw error;
        }
      },

      getPatientById:           (id)        => get().patients.find(p => p.id === id),
      getAssessmentsByPatientId: (patientId) => get().assessments.filter(a => a.patientId === patientId),
      isUhidTaken:              (uhid)      => get().patients.some(p => p.uhid.toLowerCase() === uhid.toLowerCase()),
      getTodayAssessment:       (patientId) => {
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
        console.log('Seed logic disabled for API-backed store');
      },
    }),
    {
      name: 'cevi-auth',
      partialize: (state) => ({
        token:           state.token,
        currentUser:     state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
