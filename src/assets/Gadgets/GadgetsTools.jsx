// src/assets/Gadgets/GadgetsTools.jsx
import { NavLink, Outlet } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaTools, FaFileAlt, FaCompress, FaExpand, FaHome } from "react-icons/fa";
const GadgetsTools = () => {
  const tabs = [
    { to: "/gadgets-and-tools/file-converter", icon: FaFileAlt, label: "Converter" },
    { to: "/gadgets-and-tools/image-compression", icon: FaCompress, label: "Compress" },
    { to: "/gadgets-and-tools/image-resizer", icon: FaExpand, label: "Resizer" }
  ];
  const TabItem = ({ to, icon: Icon, label, end = false }) => (
    <li className="nav-item">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `nav-link d-flex flex-column align-items-center rounded-4 px-3 py-2 border-0 ${isActive
            ? "active fw-semibold text-white bg-danger shadow-sm"
            : "text-dark bg-transparent"
          }`
        }
      >
        <Icon className="mb-1" size={14} />
        <small className="fw-medium">{label}</small>
      </NavLink>
    </li>
  );

  return (
    <div className="d-flex flex-column vh-100 bg-light">
      <header className="bg-primary text-white sticky-top shadow-sm">
        <div className="container w-100 p-3">
          <div className="d-flex align-items-center justify-content-between">
            <NavLink to="/" className="btn btn-sm text-white p-0" aria-label="Home">
              <FaHome size={26} />
            </NavLink>
            <h5 className="mb-0 fw-bold">Tools & Utilities</h5>
          </div>
        </div>
      </header>

      <nav className="bg-white sticky-top shadow-sm border-bottom">
        <div className="container w-100 py-3 mx-0 px-0">
          <ul className="nav nav-pills nav-fill gap-1 py-2 m-0">
            {tabs.map((tab) => (
              <TabItem key={tab.to} {...tab} />
            ))}
          </ul>
        </div>
      </nav>

      <main className="flex-grow-1 overflow-auto">
        <div className="container w-100 py-3 mx-0 px-0 py-3">
          <Outlet />
        </div>
      </main>

      <footer className="bg-white border-top py-2">
        <div className="container w-100 py-3 mx-0 px-0 text-center">
          <small className="text-muted">Swipe for more tools</small>
        </div>
      </footer>
    </div>
  );
};

export default GadgetsTools;