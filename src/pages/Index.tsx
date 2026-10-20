import { StoreProvider, useStore } from "@/lib/store";
import Sidebar, { useVisibleSections } from "@/components/app/Sidebar";
import Topbar from "@/components/app/Topbar";
import { Empty } from "@/components/app/PageHeader";
import Icon from "@/components/ui/icon";
import Home from "@/components/sections/Home";
import Tests from "@/components/sections/Tests";
import Questions from "@/components/sections/Questions";
import Results from "@/components/sections/Results";
import Groups from "@/components/sections/Groups";
import News from "@/components/sections/News";
import FaqSection from "@/components/sections/FaqSection";
import Support from "@/components/sections/Support";
import Profile, { AuthScreen } from "@/components/sections/Profile";
import DevPanel from "@/components/sections/DevPanel";
import CustomSection from "@/components/sections/CustomSection";
import Chat from "@/components/sections/Chat";
import Leaderboard from "@/components/sections/Leaderboard";
import CallsBase from "@/components/sections/CallsBase";
import Footer from "@/components/app/Footer";
import Announcement from "@/components/app/Announcement";
import { ProfileCard } from "@/components/app/Media";

function Content() {
  const { view, db, user } = useStore();
  const visible = useVisibleSections();

  if (db.settings.maintenance && user?.role !== "dev" && view !== "profile") {
    return (
      <div className="banner-glow flex min-h-[calc(100vh-68px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon name="Wrench" size={40} className="text-glow" />
        <h1 className="font-head text-4xl font-medium">Идут технические работы</h1>
        <p className="max-w-md whitespace-pre-line text-muted-foreground">{db.settings.maintenanceText || "Скоро всё заработает. Спасибо за терпение."}</p>
      </div>
    );
  }

  if (view !== "home" && view !== "profile" && !visible.some((s) => s.id === view)) {
    return <div className="px-4 py-10 md:px-9"><Empty text="Раздел недоступен для вашей роли" /></div>;
  }

  switch (view) {
    case "home": return <Home />;
    case "tests": return <Tests />;
    case "questions": return <Questions />;
    case "results": return <Results />;
    case "groups": return <Groups />;
    case "news": return <News />;
    case "faq": return <FaqSection />;
    case "support": return <Support />;
    case "profile": return <Profile />;
    case "dev": return <DevPanel />;
    case "chat": return <Chat />;
    case "leaderboard": return <Leaderboard />;
    case "calls": return <CallsBase />;
    default: return <CustomSection id={view} />;
  }
}

function Shell() {
  const { user, profileId, openProfile } = useStore();
  if (!user) return <div className="min-h-screen bg-background text-foreground"><AuthScreen /></div>;
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Announcement />
        <Topbar />
        <main className="flex-1">
          <Content />
        </main>
        <Footer />
        <ProfileCard userId={profileId} onClose={() => openProfile(null)} />
      </div>
    </div>
  );
}

const Index = () => (
  <StoreProvider>
    <Shell />
  </StoreProvider>
);

export default Index;
