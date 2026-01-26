import { getRooms } from "@/lib/actions/reservations";

export default async function TestDbPage() {
  const result = await getRooms();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Database Connection Test</h1>
      <hr />

      <h2>getRooms() Result:</h2>
      <pre
        style={{
          background: result.success ? "#d4edda" : "#f8d7da",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>

      <h2>Summary:</h2>
      <ul>
        <li>
          <strong>Success:</strong> {result.success ? "Yes" : "No"}
        </li>
        <li>
          <strong>Rooms Found:</strong> {result.data?.length ?? 0}
        </li>
        {result.error && (
          <li>
            <strong>Error:</strong> {result.error}
          </li>
        )}
      </ul>

      {result.data && result.data.length > 0 && (
        <>
          <h2>Rooms List:</h2>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
            }}
          >
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Name</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Capacity</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Features</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((room) => (
                <tr key={room.id}>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>{room.name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>{room.capacity}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {room.features?.join(", ") || "None"}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {room.is_active ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr />
      <p style={{ color: "#666", fontSize: "0.9em" }}>
        This is a diagnostic page. Visit <code>/test-db</code> to verify database connectivity.
      </p>
    </div>
  );
}
