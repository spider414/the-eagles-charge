import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, MessageCircle, Mail, Phone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SupportChatDialog from "@/components/SupportChatDialog";

// WhatsApp icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const Support = () => {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const supportOptions = [
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Chat with Harry, our AI assistant",
      action: () => setChatOpen(true),
      buttonText: "Start Chat",
    },
    {
      icon: WhatsAppIcon,
      title: "WhatsApp Support",
      description: "Chat with us on WhatsApp",
      action: () => window.open("https://wa.me/35677980822", "_blank"),
      buttonText: "Open WhatsApp",
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "henry4god99@gmail.com",
      action: () => window.open("mailto:henry4god99@gmail.com", "_blank"),
      buttonText: "Send Email",
    },
    {
      icon: Phone,
      title: "Phone Support",
      description: "+35677980822",
      action: () => window.open("tel:+35677980822", "_blank"),
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
      answer: "You can reach us via Live Chat with Harry (AI), WhatsApp, email, or phone using the options above.",
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
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted">
                    <option.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{option.title}</p>
                    <p className="text-sm text-muted-foreground break-words">{option.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={option.action} className="w-full sm:w-auto shrink-0">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {option.buttonText}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Additional Email */}
        <Card>
          <CardHeader>
            <CardTitle>Alternative Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-muted">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">Secondary Email</p>
                  <p className="text-sm text-muted-foreground break-all">harrisonokeke91@gmail.com</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open("mailto:harrisonokeke91@gmail.com", "_blank")} className="w-full sm:w-auto shrink-0">
                <ExternalLink className="h-4 w-4 mr-1" />
                Send Email
              </Button>
            </div>
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

      {/* AI Chat Dialog */}
      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
};

export default Support;
