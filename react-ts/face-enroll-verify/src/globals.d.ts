import {
  FaceEnrollWebComponent,
  IFaceEnroll,
  FaceLivenessWebComponent,
  IFaceLiveness,
  FaceVerifyWebComponent,
  IFaceVerify,
} from "@regulaforensics/vp-frontend-face-components";

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "face-enroll": React.DetailedHTMLProps<
        IFaceEnroll & React.HTMLAttributes<FaceEnrollWebComponent>,
        FaceEnrollWebComponent
      >;
      "face-liveness": React.DetailedHTMLProps<
        IFaceLiveness & React.HTMLAttributes<FaceLivenessWebComponent>,
        FaceLivenessWebComponent
      >;
      "face-verify": React.DetailedHTMLProps<
        IFaceVerify & React.HTMLAttributes<FaceVerifyWebComponent>,
        FaceVerifyWebComponent
      >;
    }
  }
}
