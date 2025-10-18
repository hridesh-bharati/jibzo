// src/assets/Gadgets/GadgetsTools.jsx
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { FaHome, FaExchangeAlt, FaCompressAlt, FaExpandAlt, FaStickyNote, FaCalculator, FaTools, FaFilePdf, FaFileWord, FaCamera, FaSearch } from "react-icons/fa";

const tabs = [
  { to: "/gadgets-and-tools/file-converter", icon: FaExchangeAlt, label: "Convert" },
  { to: "/gadgets-and-tools/image-compression", icon: FaCompressAlt, label: "Compress" },
  { to: "/gadgets-and-tools/image-resizer", icon: FaExpandAlt, label: "Resize" },
  { to: "/gadgets-and-tools/face-sticker", icon: FaStickyNote, label: "Face" },
  { to: "/gadgets-and-tools/age-calculator", icon: FaCalculator, label: "Age" },
];

const TabItem = ({ to, icon: Icon, label, isActive }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `nav-link d-flex flex-column align-items-center px-2 py-2 text-decoration-none ${
        isActive 
          ? "text-white bg-primary rounded shadow-sm" 
          : "text-dark bg-light rounded"
      } transition-all`
    }
    style={{ 
      minWidth: '60px',
      transition: 'all 0.3s ease'
    }}
  >
    <Icon size={18} className={isActive ? "text-white" : "text-muted"} />
    <small className="fw-medium mt-1">{label}</small>
  </NavLink>
);

const GadgetsTools = () => {
  const location = useLocation();

  return (
    <div className="d-flex flex-column vh-100 bg-light">
      {/* Enhanced Header */}
      <header className="bg-gradient-primary text-white sticky-top shadow-sm">
        <div className="d-flex align-items-center justify-content-between px-3 py-2">
          <NavLink 
            to="/" 
            className="btn btn-light btn-sm p-2 rounded-circle shadow-sm"
            title="Back to Home"
          >
            <FaHome size={16} className="text-primary" />
          </NavLink>
          <h6 className="mb-0 fw-bold text-truncate mx-2 d-flex align-items-center">
            <FaTools className="me-2" size={16} /> 
            Tools & Utilities
          </h6>
          <div className="d-flex align-items-center">
            <small className="text-light opacity-75">
              {new Date().toLocaleDateString()}
            </small>
          </div>
        </div>
      </header>

      {/* Enhanced Tabs Navigation */}
      <nav className="bg-white sticky-top border-bottom shadow-sm">
        <div className="container-fluid px-2 py-2">
          <div className="nav nav-pills gap-2 d-flex justify-content-between align-items-stretch">
            {tabs.map(tab => (
              <div key={tab.to} className="nav-item flex-fill text-center">
                <TabItem 
                  {...tab} 
                  isActive={location.pathname === tab.to}
                />
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content with better styling */}
      <main className="flex-grow-1 overflow-auto bg-gradient-light">
        <div className="container-fluid h-100 p-0">
          <Outlet />
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="bg-white border-top py-3 text-center shadow-sm">
        <div className="container-fluid">
          <small className="text-muted d-block mb-1">
            🔧 Powerful Tools at Your Fingertips
          </small>
          <small className="text-muted d-block">
            Swipe horizontally for more tools →
          </small>
        </div>
      </footer>

      <style>{`
        .bg-gradient-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .bg-gradient-light {
          background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
        }
        
        .transition-all {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .nav-link:hover:not(.active) {
          background-color: #e3f2fd !important;
          transform: translateY(-2px);
        }
        
        .nav-link.active {
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }
        
        .shadow-sm {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default GadgetsTools;