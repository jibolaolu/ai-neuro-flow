/** Calendar overlay for booked assessments (live data only - pass [] until wired to API). */
export type AssessmentBooking = {
  id: string;
  caseId: string;
  clientName: string;
  clinicianId: string;
  clinicianName: string;
  assessmentType: string;
  date: string;
  dayLabel: string;
  start: string;
  end: string;
  room: string;
  spacingStatus: "healthy" | "tight";
  loadScore: number;
};
