import { Bird } from "lucide-react";

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
              THE <span className="text-gradient-gold">EAGLES</span>
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-primary-foreground/70">
            <a href="#" className="hover:text-primary-foreground transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary-foreground transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary-foreground transition-colors">
              Contact Us
            </a>
            <a href="#" className="hover:text-primary-foreground transition-colors">
              FAQ
            </a>
          </div>

          <p className="text-sm text-primary-foreground/50">
            © 2026 The Eagles. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
