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
      <h1>data from firestore lesgooooooo</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{JSON.stringify(post)}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;