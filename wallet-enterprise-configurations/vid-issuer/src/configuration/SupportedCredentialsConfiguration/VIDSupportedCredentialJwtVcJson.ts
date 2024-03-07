import config from "../../../config";
import { CategorizedRawCredentialView, CategorizedRawCredentialViewRow } from "../../openid4vci/Metadata";
import { VerifiableCredentialFormat, Display, CredentialSupportedJwtVcJson } from "../../types/oid4vci";
import { CredentialSubject } from "../CredentialSubjectBuilders/CredentialSubject.type";
import { getVIDByTaxisId } from "../resources/data";
import { CredentialIssuer } from "../../lib/CredentialIssuerConfig/CredentialIssuer";
import { SupportedCredentialProtocol } from "../../lib/CredentialIssuerConfig/SupportedCredentialProtocol";
import { AuthorizationServerState } from "../../entities/AuthorizationServerState.entity";
import { CredentialView } from "../../authorization/types";


export class VIDSupportedCredentialJwtVcJson implements SupportedCredentialProtocol {


  constructor(private credentialIssuerConfig: CredentialIssuer) { }

  getCredentialIssuerConfig(): CredentialIssuer {
    return this.credentialIssuerConfig;
  }
  getId(): string {
    return "urn:credential:vid"
  }
  getFormat(): VerifiableCredentialFormat {
    return VerifiableCredentialFormat.JWT_VC_JSON;
  }
  getTypes(): string[] {
    return ["VerifiableCredential", "VerifiableAttestation", "VerifiableId", this.getId()];
  }
  getDisplay(): Display {
		return {
			name: "Verifiable ID",
			logo: { url: config.url + "/images/vidCard.png" },
			background_color: "#4CC3DD"
		}
  }


  async getProfile(userSession: AuthorizationServerState): Promise<CredentialView | null> {
    if (!userSession?.taxis_id) {
      return null;
    }
		const vids = [await getVIDByTaxisId(userSession?.taxis_id)];
		const credentialViews: CredentialView[] = vids
			.map((vid) => {
				const rows: CategorizedRawCredentialViewRow[] = [
					{ name: "Family Name", value: vid.familyName },
					{ name: "First Name", value: vid.firstName },
					{ name: "Personal Identifier", value: vid.personalIdentifier },
					{ name: "Date of Birth", value: vid.birthdate },
				];
				const rowsObject: CategorizedRawCredentialView = { rows };
				
				return {
					credential_id: this.getId(),
					credential_supported_object: this.exportCredentialSupportedObject(),
					view: rowsObject,
					deferredFlow: false,
				}
			})
		return credentialViews[0];
  }
  
  async generateCredentialResponse(userSession: AuthorizationServerState, holderDID: string): Promise<{ format: VerifiableCredentialFormat; credential: any;  }> {
		if (!userSession.taxis_id) {
			throw new Error("Cannot generate credential: Taxis id is missing");
		}
		
		const vidEntry = await getVIDByTaxisId(userSession?.taxis_id);

		if (!vidEntry) {
			console.error("Possibly raw data w not found")
			throw new Error("Could not generate credential response");
		}

		const vid: CredentialSubject = {
			familyName: vidEntry.familyName,
			firstName: vidEntry.firstName,
			personalIdentifier: vidEntry.personalIdentifier,
			dateOfBirth: vidEntry.birthdate
		} as any;

		const payload = {
			"@context": ["https://www.w3.org/2018/credentials/v1"],
			"type": this.getTypes(),
			"credentialSubject": {
				...vid,
				"id": holderDID,
			},
			"credentialSchema": {
				"id": "https://api-pilot.ebsi.eu/trusted-schemas-registry/v2/schemas/z8Y6JJnebU2UuQQNc2R8GYqkEiAMj3Hd861rQhsoNWxsM",
				"type": "JsonSchema",
			},
			"name": "Verifiable ID",
			"description": "A verifiable ID credential issued by the National Verifiable ID Issuer",
			"credentialBranding": {
				"backgroundColor": "#4cc3de",
				"textColor": "#ffffff"
			},
		};
		const { jws } = await this.getCredentialIssuerConfig().getCredentialSigner()
			.sign(payload, {});
    const response = {
      format: this.getFormat(),
      credential: jws
    };

    return response;
  }

	exportCredentialSupportedObject(): CredentialSupportedJwtVcJson {
		return {
			id: this.getId(),
			format: this.getFormat(),
			display: [ this.getDisplay() ],
			types: this.getTypes(),
			cryptographic_binding_methods_supported: ["ES256"]
		}
	}

}

