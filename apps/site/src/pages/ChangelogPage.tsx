import { PageHeader } from "../components/SiteLayout"
import { CHANGELOG } from "../content/changelog"

export function ChangelogPage() {
  return (
    <>
      <PageHeader title="Changelog">
        <p>What changed in each Slacktor release, newest first.</p>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <ol className="border-t">
          {CHANGELOG.map((release) => {
            const anchor = `v${release.version.replaceAll(".", "-")}`
            return (
              <li
                key={release.version}
                id={anchor}
                aria-labelledby={`${anchor}-title`}
                className="grid scroll-mt-24 gap-4 border-b py-10 md:grid-cols-[12rem_1fr] md:gap-10"
              >
                <div className="md:sticky md:top-24 md:self-start">
                  <h2 id={`${anchor}-title`} className="text-2xl font-semibold tracking-tight">
                    <a href={`#${anchor}`} className="hover:text-primary">
                      {release.version}
                    </a>
                  </h2>
                </div>

                <div className="max-w-[68ch]">
                  <p className="text-lg leading-relaxed text-pretty">{release.summary}</p>
                  {release.sections.map((section) => (
                    <section key={section.title} className="mt-6">
                      <h3 className="text-muted-foreground text-sm font-semibold">
                        {section.title}
                      </h3>
                      <ul className="marker:text-primary mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}
