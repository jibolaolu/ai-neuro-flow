import { SurveyForm } from "./SurveyForm";

export default function SurveyPage({ params }: { params: { token: string } }) {
  return <SurveyForm token={params.token} />;
}
