import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";

const ComingSoon = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  const availableServices: {
    icon: typeof Clock;
    title: string;
    description: string;
    color: string;
    link: string;
    available: boolean;
  }[] = [];

  const upcomingServices: {
    icon: typeof Clock;
    title: string;
    description: string;
    color: string;
  }[] = [];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-foreground">
                  Coming <span className="text-gradient-gold">Soon</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-8 max-w-2xl">
          {/* Hero Section */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Clock className="h-12 w-12 text-primary animate-pulse-soft" />
            </div>
            <h1 className="text-3xl font-bold mb-3">Exciting Services Coming Soon!</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're working hard to bring you more amazing services. Stay tuned for updates!
            </p>
          </div>

          {/* Available Services */}
          {availableServices.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">NOW AVAILABLE</h2>
            {availableServices.map((service, index) => (
              <Link to={service.link} key={service.title}>
                <Card 
                  className="overflow-hidden animate-fade-in hover:shadow-card hover:border-primary/50 transition-all cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl ${service.color} flex items-center justify-center shrink-0`}>
                        <service.icon className="h-7 w-7 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{service.title}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          )}

          {/* Upcoming Services */}
          {upcomingServices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">COMING SOON</h2>
            <div className="space-y-4">
              {upcomingServices.map((service, index) => (
                <Card 
                  key={service.title} 
                  className="overflow-hidden animate-fade-in opacity-75"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl ${service.color} flex items-center justify-center shrink-0`}>
                        <service.icon className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1">{service.title}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          )}

          {/* Notify Me Card */}
          <Card className="gradient-hero text-primary-foreground animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardContent className="p-6 text-center">
              <Bell className="h-10 w-10 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Get Notified</h3>
              <p className="text-primary-foreground/80 mb-4">
                We'll notify you as soon as these services are available. Keep an eye on your dashboard!
              </p>
              <Button 
                variant="secondary" 
                className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0"
                onClick={() => navigate("/dashboard")}
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
};

export default ComingSoon;
