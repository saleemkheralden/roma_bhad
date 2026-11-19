// Pure composition of the evening summary (no server imports: unit-testable).

export type SummaryInput = {
  teamName: string;
  dueTomorrow: number; // my open tasks due tomorrow (incl. team-wide parts not done)
  newTeamTasksToday: number;
  tomorrowRoles: { role: string; name: string; isMe: boolean }[];
};

/** One notification line per team, or null when there is nothing worth sending. */
export function composeSummary(i: SummaryInput): { title: string; body: string } | null {
  const parts: string[] = [];
  const mine = i.tomorrowRoles.filter((r) => r.isMe);
  if (mine.length) parts.push(`מחר את/ה ${mine.map((r) => r.role).join(", ")}`);
  if (i.dueTomorrow === 1) parts.push("משימה אחת למחר");
  else if (i.dueTomorrow > 1) parts.push(`${i.dueTomorrow} משימות למחר`);
  if (i.newTeamTasksToday === 1) parts.push("משימת צוות חדשה היום");
  else if (i.newTeamTasksToday > 1) parts.push(`${i.newTeamTasksToday} משימות צוות חדשות היום`);
  const others = i.tomorrowRoles.filter((r) => !r.isMe);
  if (others.length) parts.push(`בתפקיד מחר: ${others.map((r) => `${r.role} ${r.name}`).join(", ")}`);
  if (parts.length === 0) return null;
  return { title: `סיכום ערב · ${i.teamName}`, body: parts.join(" · ") };
}
