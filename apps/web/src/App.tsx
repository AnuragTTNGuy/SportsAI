import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { CompetitionsPage } from "./pages/CompetitionsPage";
import { MatchesPage } from "./pages/MatchesPage";
import { InsightsPage } from "./pages/InsightsPage";
import { EmbedWidgetsPage } from "./pages/EmbedWidgetsPage";
import { SportsHomePage } from "./pages/SportsHomePage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="top-nav">
          <Link className="brand brand-link" to="/">Sports Insights</Link>
        </nav>
        <main className="container">
          <Routes>
            <Route path="/" element={<SportsHomePage />} />
            <Route path="/:sport" element={<CompetitionsPage />} />
            <Route path="/:sport/competitions/:competitionId/matches" element={<MatchesPage />} />
            <Route path="/competitions/:competitionId/matches" element={<Navigate to="/football" replace />} />
            <Route path="/matches/:eventId/insights" element={<InsightsPage />} />
            <Route path="/matches/:eventId/embed" element={<EmbedWidgetsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
