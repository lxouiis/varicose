import { HashRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { NewPatient } from "./pages/NewPatient";
import { AssessmentForm } from "./pages/AssessmentForm";
import { AssessmentReportPage } from "./pages/Report";
import { Login } from "./pages/Login";
import { ResetPassword } from "./pages/ResetPassword";
import { Admin } from "./pages/Admin";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Outside Layout (no nav bar) — this must be reachable even while
            Layout would otherwise redirect every other route here. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients/new" element={<NewPatient />} />
          <Route path="assessment/new/:patientId" element={<AssessmentForm />} />
          <Route path="assessment/:id/report" element={<AssessmentReportPage />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
