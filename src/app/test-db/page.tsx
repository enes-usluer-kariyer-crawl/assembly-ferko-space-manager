import { getRooms } from "@/lib/actions/reservations";

export default async function TestDbPage() {
  const result = await getRooms();

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Veritabanı Bağlantı Testi</h1>
      <hr />

      <h2>getRooms() Sonucu:</h2>
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

      <h2>Özet:</h2>
      <ul>
        <li>
          <strong>Başarılı:</strong> {result.success ? "Evet" : "Hayır"}
        </li>
        <li>
          <strong>Bulunan Oda Sayısı:</strong> {result.data?.length ?? 0}
        </li>
        {result.error && (
          <li>
            <strong>Hata:</strong> {result.error}
          </li>
        )}
      </ul>

      {result.data && result.data.length > 0 && (
        <>
          <h2>Oda Listesi:</h2>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
            }}
          >
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>İsim</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Kapasite</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Özellikler</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Aktif</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((room) => (
                <tr key={room.id}>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>{room.name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>{room.capacity}</td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {room.features?.join(", ") || "Yok"}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {room.is_active ? "Evet" : "Hayır"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr />
      <p style={{ color: "#666", fontSize: "0.9em" }}>
        Bu bir tanılama sayfasıdır. Veritabanı bağlantısını doğrulamak için <code>/test-db</code> adresini ziyaret edin.
      </p>
    </div>
  );
}
