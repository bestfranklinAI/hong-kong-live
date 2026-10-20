export function RouteServiceNotes({ messages = [] }: { messages?: string[] }) {
  if (!messages.length) return null;
  const ignored = messages.some((message) =>
    /not valid|ignored|not located|unlocated/i.test(message),
  );
  const avoided = messages.some((message) => /avoid-restrictions/i.test(message));
  const descriptions: Record<string, string> = {
    'Avoid Staircase (high)': 'stairs',
    'Avoid Outdoor (high)': 'outdoor sections',
    'Avoid Paid Area (high)': 'paid-area links',
    'Avoid Lift (high)': 'lifts',
    'Avoid Escalator (high)': 'escalators',
  };
  const names = new Set(
    messages
      .filter((message) => /avoid-restrictions/i.test(message))
      .flatMap((message) => [...message.matchAll(/"([^"]+)"/g)].map((match) => match[1])),
  );
  const conditions = Object.entries(descriptions).flatMap(([name, description]) =>
    names.has(name) ? [description] : [],
  );
  const allKnown = names.size > 0 && conditions.length === names.size;
  const summary = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
    conditions,
  );
  return (
    <details className="route-source-messages">
      <summary>
        {ignored
          ? 'Some route options were not applied'
          : avoided
            ? allKnown
              ? `Route includes ${summary}`
              : 'Some route preferences could not be met'
            : 'Route service notes'}
      </summary>
      {avoided && (
        <p>
          The solver tried to avoid {summary || 'some types of paths'}, but the returned route still
          uses them. These are preferences, not absolute bans.
        </p>
      )}
      {names.has('Avoid Paid Area (high)') && (
        <p>
          “Paid-area” is a source classification. This message does not tell us whether you must
          pay; check entry signs.
        </p>
      )}
      {ignored && (
        <p>
          The service could not apply one or more requested options. Review its message before
          relying on the route.
        </p>
      )}
      <details>
        <summary>Original service message</summary>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </details>
    </details>
  );
}
