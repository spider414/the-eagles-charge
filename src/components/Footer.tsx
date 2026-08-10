import { Bird } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="gradient-hero py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold shadow-gold">
              <Bird className="h-6 w-6 text-secondary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary-foreground">
              HARMIC <span className="text-gradient-gold">RECHARGE</span>
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-primary-foreground/70">
            <Link to="/terms" className="hover:text-primary-foreground transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-primary-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/support" className="hover:text-primary-foreground transition-colors">
              Contact Us
            </Link>
            <a href="#faq" className="hover:text-primary-foreground transition-colors">
              FAQ
            </a>
          </div>

          <p className="text-sm text-primary-foreground/50">
            © 2026 HARMIC RECHARGE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
