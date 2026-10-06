import * as React from "react";
import {
  FaceEnrollDetailType,
  FaceEnrollResponseType,
  FaceEnrollWebComponent,
  FaceVerifyDetailType,
  FaceVerifyResponseType,
  FaceVerifyWebComponent,
} from "@regulaforensics/vp-frontend-face-components";
import "@regulaforensics/vp-frontend-face-components";

const serviceUrl = "/face-api";

const containerStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  position: "absolute",
  height: "100%",
  width: "100%",
  top: 0,
  left: 0,
  justifyContent: "center",
  alignItems: "center",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 30px",
  color: "white",
  fontSize: "16px",
  borderRadius: "2px",
  backgroundColor: "#bd7dff",
  border: "1px solid #bd7dff",
  cursor: "pointer",
};

const buttonContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
};

const resultTextStyle: React.CSSProperties = {
  maxWidth: "250px",
  fontSize: "14px",
  color: "#333",
  margin: 0,
};

const resultContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

function OriginalApp() {
  const [openComponent, setOpenComponent] = React.useState<"enroll" | "verify" | null>(null);
  const [personId, setPersonId] = React.useState("");
  const [enrollResponse, setEnrollResponse] = React.useState<FaceEnrollResponseType | null>(null);
  const [verifyResponse, setVerifyResponse] = React.useState<FaceVerifyResponseType | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const enrollComponentRef = React.useRef<FaceEnrollWebComponent | null>(null);
  const verifyComponentRef = React.useRef<FaceVerifyWebComponent | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const enrollListener = (event: CustomEvent<FaceEnrollDetailType>) => {
      if (event.detail.action === "PROCESS_FINISHED" && event.detail.data?.status === 1) {
        const response = event.detail.data.response;
        if (response) {
          setPersonId(response.enrollResult?.person?.id || "");
          setEnrollResponse(response);
        }
      }
      if (event.detail.action === "CLOSE" || event.detail.action === "RETRY_COUNTER_EXCEEDED") {
        setOpenComponent(null);
      }
    };

    const verifyListener = (event: CustomEvent<FaceVerifyDetailType>) => {
      if (event.detail.action === "PROCESS_FINISHED" && event.detail.data?.status === 1) {
        if (event.detail.data.response) setVerifyResponse(event.detail.data.response);
      }
      if (event.detail.action === "CLOSE" || event.detail.action === "RETRY_COUNTER_EXCEEDED") {
        setOpenComponent(null);
      }
    };

    container.addEventListener("face-enroll", enrollListener);
    container.addEventListener("face-verify", verifyListener);
    return () => {
      container.removeEventListener("face-enroll", enrollListener);
      container.removeEventListener("face-verify", verifyListener);
    };
  }, []);

  React.useEffect(() => {
    if (openComponent === "enroll" && enrollComponentRef.current) {
      enrollComponentRef.current.settings = {
        url: serviceUrl,
        enroll: { person: {} },
        customization: { onboardingScreenStartButtonBackground: "#5b5050" },
      };
    }
    if (openComponent === "verify" && verifyComponentRef.current) {
      verifyComponentRef.current.settings = {
        url: serviceUrl,
        verify: { personId },
        customization: { onboardingScreenStartButtonBackground: "#5b5050" },
      };
    }
  }, [openComponent, personId]);

  return (
    <div style={containerStyle} ref={containerRef}>
      {!openComponent && (
        <div style={resultContainerStyle}>
          <a href="/" style={{ color: "#6d5a75" }}>← Sample chooser</a>
          {enrollResponse?.enrollResult && (
            <div>
              <h4 style={resultTextStyle}>Enroll info:</h4>
              {enrollResponse.images[0] && <img src={`data:image/jpeg;base64,${enrollResponse.images[0]}`} style={{ width: 300, height: "auto" }} alt="Enrolled face" />}
              <p style={resultTextStyle}>Enrolled: {String(enrollResponse.enrollResult.enrolled)}</p>
              <p style={resultTextStyle}>Person ID: {enrollResponse.enrollResult.person?.id || "—"}</p>
              <p style={resultTextStyle}>Person name: {enrollResponse.enrollResult.person?.name || "—"}</p>
            </div>
          )}
          {verifyResponse?.verifyResult && (
            <div>
              <h4 style={resultTextStyle}>Verification info:</h4>
              <p style={resultTextStyle}>Verified: {String(verifyResponse.verifyResult.verified)}</p>
              <p style={resultTextStyle}>Similarity: {verifyResponse.verifyResult.match?.similarity ?? "—"}</p>
            </div>
          )}
          <input aria-label="Person ID" placeholder="Person ID" value={personId} onChange={(event) => setPersonId(event.target.value)} />
          <div style={buttonContainerStyle}>
            <button style={buttonStyle} onClick={() => setOpenComponent("enroll")}>Open Enroll</button>
            <button style={buttonStyle} onClick={() => {
              if (!personId) {
                alert("Please enter a person ID or enroll a new person");
                return;
              }
              setOpenComponent("verify");
            }}>Open Verify</button>
          </div>
        </div>
      )}
      {openComponent === "enroll" && <face-enroll ref={enrollComponentRef} />}
      {openComponent === "verify" && <face-verify ref={verifyComponentRef} />}
    </div>
  );
}

export default OriginalApp;
