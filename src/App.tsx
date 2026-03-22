import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Members from "./pages/Members";
import Projects from "./pages/Projects";
import Bids from "./pages/Assignments";
import AccessControl from "./pages/AccessControl";
import Hiring from "./pages/Hiring";
import Mentorship from "./pages/Mentorship";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/members" replace />} />
        <Route path="members" element={<Members />} />
        <Route path="members/access-control" element={<AccessControl />} />
        <Route path="members/mentorship" element={<Mentorship />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/assignments" element={<Bids />} />
        <Route path="hiring" element={<Hiring />} />
      </Route>
    </Routes>
  );
}
