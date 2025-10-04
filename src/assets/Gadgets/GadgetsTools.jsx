// src/assets/Gadgets/GadgetsTools.jsx
import { NavLink, Outlet } from "react-router-dom";
import { FaHome, FaExchangeAlt, FaCompressAlt, FaExpandAlt, FaStickyNote, FaCalculator, FaTools } from "react-icons/fa";

const tabs = [
  { to: "/gadgets-and-tools/file-converter", icon: FaExchangeAlt, label: "Convert" },
  { to: "/gadgets-and-tools/image-compression", icon: FaCompressAlt, label: "Compress" },
  { to: "/gadgets-and-tools/image-resizer", icon: FaExpandAlt, label: "Resize" },
  { to: "/gadgets-and-tools/face-sticker", icon: FaStickyNote, label: "Face" },
  { to: "/gadgets-and-tools/age-calculator", icon: FaCalculator, label: "Age" }
];

const TabItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `nav-link d-flex flex-column align-items-center px-1 py-2 ${isActive ? "text-white bg-danger" : "text-dark"}`
    }
  >
    <Icon size={16} />
    <small>{label}</small>
  </NavLink>
);

const GadgetsTools = () => (
  <div className="d-flex flex-column vh-100 bg-light">
    {/* Header */}
    <header className="bg-primary text-white sticky-top">
      <div className="d-flex align-items-center justify-content-between px-3 py-2">
        <NavLink to="/" className="btn text-white p-1"><FaHome size={20} /></NavLink>
        <h6 className="mb-0 fw-bold text-truncate mx-2">
          <FaTools className="me-2" size={14} /> Tools & Utilities
        </h6>
        <div style={{ width: "20px" }} />
      </div>
    </header>

    {/* Tabs */}
    <nav className="bg-white sticky-top border-bottom">
      <ul className="nav nav-pills gap-1 p-0 m-1 d-flex">
        {tabs.map(tab => <li key={tab.to} className="nav-item flex-fill"><TabItem {...tab} /></li>)}
      </ul>
    </nav>

    {/* Main content */}
    <main className="flex-grow-1 overflow-auto">
      <Outlet />
    </main>

    {/* Footer */}
    <footer className="bg-white border-top py-2 text-center">
      <small className="text-muted">Swipe for more tools</small>
    </footer>
  </div>
);

export default GadgetsTools;
