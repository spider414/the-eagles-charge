import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, MessageCircle, Mail, Phone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Support = () => {
  const navigate = useNavigate();

  const supportOptions = [
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Chat with our support team",
      action: () => window.open("https://wa.me/2348132111417", "_blank"),
      buttonText: "Start Chat",
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "Send us an email",
      action: () => window.open("mailto:support@theeagles.com", "_blank"),
      buttonText: "Send Email",
    },
    {
      icon: Phone,
      title: "Phone Support",
      description: "Call our support line",
      action: () => window.open("tel:+2348132111417", "_blank"),
      buttonText: "Call Now",
    },
  ];

  const faqs = [
    {
      question: "How do I top up my wallet?",
      answer: "You can top up your wallet via bank transfer to your dedicated virtual account or by using card payment.",
    },
    {
      question: "How long does airtime/data take to deliver?",
      answer: "Airtime and data purchases are usually instant. In rare cases, it may take up to 5 minutes.",
    },
    {
      question: "What happens if my transaction fails?",
      answer: "Failed transactions are automatically refunded to your wallet within minutes.",
    },
    {
      question: "How do I contact support?",
      answer: "You can reach us via WhatsApp, email, or phone using the options above.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <Bird className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-semibold">Help & Support</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-6">
        {/* Support Options */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
            <CardDescription>Choose how you'd like to reach our support team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {supportOptions.map((option, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <option.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{option.title}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={option.action}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {option.buttonText}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-border last:border-0 pb-4 last:pb-0">
                <p className="font-medium">{faq.question}</p>
                <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* App Info */}
        <p className="text-center text-sm text-muted-foreground">
          THE EAGLES VTU v1.0.0
        </p>
      </main>
    </div>
  );
};

export default Support;
