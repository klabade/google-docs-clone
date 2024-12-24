import React, { useRef, useEffect, useState } from "react";
import ReactQuill from "react-quill";
import { setDoc, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase-config";
import "react-quill/dist/quill.snow.css";
import { throttle } from "lodash";

export default function TextEditor() {
  const quillReff = useRef(null);
  const isLocalChange = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const documentRef = doc(db, "documents", "sample-doc");
  const saveContent = throttle(() => {
    if (quillReff.current && isLocalChange.current) {
      const content = quillReff.current.getEditor().getContents();
      console.log("Saving content to db: ", content);
      setDoc(documentRef, { content: content.ops }, { merge: true })
        .then(() => {
          console.log("Content Saved");
        })
        .catch(console.error);
      isLocalChange.current = false;
    }
  });

  useEffect(() => {
    if (quillReff.current) {
      //Load initial content from Firebase db
      getDoc(documentRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const saveContent = docSnap.data().content;

            if (saveContent) {
              quillReff.current.getEditor().setContents(saveContent);
            }
          } else {
            console.log(" No Doc found");
          }
        })
        .catch(console.error);

      //listen firestore for any updates and update locally in real-time
      const unsubscribe = onSnapshot(documentRef, (snapShot) => {
        if (snapShot.exists()) {
          const newContent = snapShot.data().content;
          if (!isEditing) {
            const editor = quillReff.current.getEditor();
            const currentCursorPosition = editor.getSelection()?.index | 0;
            //APply content update silently avoid retriggering "text-change"
            editor.setContents(newContent,"silent");
            //Restore cursor position after content update
            editor.setSelection(currentCursorPosition);
          }
        }
      });

      //listen for local text changes and save it in firestore
      const editor = quillReff.current.getEditor();
      editor.on("text-change", (delta, oldDelta, source) => {
        if (source === "user") {
          isLocalChange.current = true;
          setIsEditing(true);
          saveContent();
          setTimeout(() => setIsEditing(false), 5000);
        }
      });
      return () => {
        unsubscribe();
        editor.off("text-change");
      };
    }
  }, []);
  return (
    <div className="google-docs-editor">
      <ReactQuill ref={quillReff} />
    </div>
  );
}
