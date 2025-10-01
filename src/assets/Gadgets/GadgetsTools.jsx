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
  <li className="nav-item flex-fill">
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-link d-flex flex-column align-items-center px-1 py-2 ${isActive ? "text-white bg-danger" : "text-dark"
        }`
      }
    >
      <Icon size={16} />
      <small>{label}</small>
    </NavLink>
  </li>
);

const GadgetsTools = () => {
  return (
    <div className="d-flex flex-column vh-100 bg-light">
      <header className="bg-primary text-white sticky-top">
        <div className="container-fluid px-3 py-2">
          <div className="d-flex align-items-center justify-content-between">
            <NavLink to="/" className="btn text-white p-1">
              <FaHome size={20} />
            </NavLink>
            <h6 className="mb-0 fw-bold text-truncate mx-2">
              <FaTools className="me-2" size={14} />
              Tools & Utilities
            </h6>
            <div style={{ width: "20px" }}></div>
          </div>
        </div>
      </header>

      <nav className="bg-white sticky-top border-bottom">
        <div className="container-fluid px-1 py-1">
          <ul className="nav nav-pills gap-1 p-0 m-0 d-flex">
            {tabs.map((tab) => (
              <TabItem key={tab.to} {...tab} />
            ))}
          </ul>
        </div>
      </nav>

      <main className="flex-grow-1 overflow-auto">
        <Outlet />
      </main>

      <footer className="bg-white border-top py-2">
        <div className="text-center">
          <small className="text-muted">Swipe for more tools</small>
        </div>
      </footer>
    </div>
  );
};

export default GadgetsTools;