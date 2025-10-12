import { Github, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const teamMembers = [
  {
    name: "Anirudh P S",
    role: "Co-Founder and Developer",
    image: "https://placehold.co/600x400",
    bio: "Undergraduate student at RNSIT, Data Scientiest with experience in working on AI platforms.",
    social: {
      linkedin: "https://www.linkedin.com/in/anirudh248 ",
      github: "https://github.com/Anirudh-248",
      email: "anirudhphaniraj@gmail.com",
    },
  },
  {
    name: "Manasvi M",
    role: "Co-Founder and Developer",
    image: "https://placehold.co/600x400",
    bio: "Undergraduate student at RNSIT, Full-stack engineer with expertise in building scalable data platforms.",
    social: {
      linkedin: "https://www.linkedin.com/in/manasvi-m-48419725a",
      github: "https://github.com/Manasvi27M",
      email: "manasvii.social@gmail.com",
    },
  },
  {
    name: "Pranav Keshav",
    role: "Co-Founder and Developer",
    image: "https://placehold.co/600x400",
    bio: "Undergraduate student at RNSIT, an experienced full stack engineer and an AI entusiast.",
    social: {
      linkedin: "www.linkedin.com/in/pranav-keshav-271a19183",
      github: "https://github.com/PranavKeshav24",
      email: "pranavkeshav.connect@gmail.com",
    },
  },
  {
    name: "Pratith Bhat V",
    role: "Co-Founder and Developer",
    image: "https://placehold.co/600x400",
    bio: "Undergraduate student at RNSIT, full stack engineer focused on creating intuitive data visualization interfaces.",
    social: {
      linkedin: "https://www.linkedin.com/in/pratith-bhat-843792288",
      github: "https://github.com/Pratith544",
      email: "pratithbhat@gmail.com",
    },
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen py-28 px-12">
      {/* Company Introduction */}
      <section className="container mx-auto px-4 mb-20">
        <h1 className="text-4xl font-bold text-center mb-6">
          About DataInsights AI
        </h1>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl text-muted-foreground mb-8">
            Founded in 2025, DataInsights AI is revolutionizing how businesses
            understand and utilize their data. Our platform combines
            cutting-edge AI technology with intuitive design to make data
            analysis accessible to everyone.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <h3 className="text-3xl font-bold text-primary mb-2">50K+</h3>
              <p className="text-muted-foreground">Active Users</p>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-primary mb-2">100M+</h3>
              <p className="text-muted-foreground">Datasets Analyzed</p>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-primary mb-2">98%</h3>
              <p className="text-muted-foreground">Customer Satisfaction</p>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-primary mb-2">24/7</h3>
              <p className="text-muted-foreground">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Meet Our Team</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="bg-card rounded-lg overflow-hidden border hover:scale-105 hover:transition-all hover:duration-500"
            >
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-64 object-cover"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                <p className="text-primary mb-3">{member.role}</p>
                <p className="text-muted-foreground mb-4">{member.bio}</p>
                <div className="flex gap-2">
                  <Link href={member.social.linkedin}>
                    <Button variant="ghost" size="icon">
                      <Linkedin className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href={member.social.github}>
                    <Button variant="ghost" size="icon">
                      <Github className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href={`mailto:${member.social.email}`}>
                    <Button variant="ghost" size="icon">
                      <Mail className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
