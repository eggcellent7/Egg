import { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64ToFloats } from "./utils/base64Decoder";

function App() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, "eggdata"));
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          const decodedData = docData.data
            ? docData.data.split(":").filter(Boolean).map(decodeBase64ToFloats)
            : undefined;

          return {
            id: doc.id,
            ...docData,
            data: decodedData, // Replace encoded string with decoded float arrays
          };
        });
        setPosts(data);
      } catch (err) {
        console.error("Error fetching posts:", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>EGG DATA WOOHOO</h1>
      {posts.map(post => (
        <div key={post.id} style={{ marginBottom: "2rem" }}>
          <h2>ID: {post.id}</h2>
          <p>Filename: {post.filename}</p>
          <p>Timestamp: {new Date(post.timestamp).toLocaleString()}</p>

          <table border={1} cellPadding={5} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {post.data && post.data[0] && post.data[0].map((_: any, i: number) => (
                  <th key={i}>Field {i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {post.data && post.data.map((row: any[], i: number) => (
                <tr key={i}>
                  {row.map((val, j) => (
                    <td key={j}>{typeof val === "number" ? val.toFixed(6) : val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

}

export default App;