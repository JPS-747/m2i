import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <nav className="landing-navbar">
        <div className="navbar-logo">� M2I emap</div>
        <div className="navbar-links">
          <button onClick={() => navigate('/login')} className="btn-link">Login</button>
          <button onClick={() => navigate('/register')} className="btn-primary">Register</button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <h1>M2I emap Platform</h1>
          <p>Streamline your reconciliation process with the power of M2I emap</p>
          <div className="hero-buttons">
            
          </div>
        </div>
      </section>

      {/* Removed features, CTA, and footer sections as requested */}
    </div>
  );
}
