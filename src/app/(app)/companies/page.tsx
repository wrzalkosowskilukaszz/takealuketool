import { CompaniesView } from "@/components/companies/companies-view";

export const metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Companies</h1>
          <p>
            Companies whose own career pages are watched, on top of the job boards. Favourite the ones you
            would love to work for; exclude the ones you never want to see.
          </p>
        </div>
      </header>
      <CompaniesView />
    </div>
  );
}
