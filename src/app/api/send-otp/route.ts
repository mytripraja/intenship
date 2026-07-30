      case "messagecentral": {
        const mcCustomerId = process.env.MC_CUSTOMER_ID;
        const mcPassword = process.env.MC_PASSWORD;
        if (!mcCustomerId || !mcPassword)
          throw new Error("Message Central credentials not set");

        const tokenRes = await fetch(
          `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${mcCustomerId}&key=${mcPassword}&scope=NEW&country=91`,
          { method: "GET", headers: { accept: "*/*" } }
        );
        const tokenData = await tokenRes.json();

        if (!tokenData.token) {
          throw new Error(
            `Token generation failed: ${JSON.stringify(tokenData)}`
          );
        }

        const mcSendRes = await fetch(
          `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${cleanPhone}`,
          {
            method: "POST",
            headers: { authToken: tokenData.token, accept: "*/*" },
          }
        );

        const mcSendData = await mcSendRes.json();

        if (mcSendRes.status !== 200 || !mcSendData.data?.verificationId) {
          throw new Error(
            `OTP Send Failed: ${JSON.stringify(mcSendData)}`
          );
        }

        global.otpStore[cleanPhone] = mcSendData.data.verificationId;
        break;
      }
