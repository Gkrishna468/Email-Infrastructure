export class ConnectorRouter {
  static async dispatch(connectorUrl: string, payload: any) {
    try {
      const response = await fetch(connectorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.text();
      console.log("[Connector Delivered]", result);

      return {
        success: true
      };
    } catch (error) {
      console.error("[Connector Failed]", error);
      return {
        success: false
      };
    }
  }
}
