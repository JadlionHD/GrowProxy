import {
  Client,
  TextPacket,
  Peer,
  TankPacket,
  Variant,
  PacketTypes,
  TankTypes,
  VariantTypes
} from "growtopia.js";
import { Proxy } from "./Proxy";
import axios from "axios";
import { readFileSync } from "fs";
import https from "https";
import ansi from "ansi-colors";
import { ProxyConfig } from "../types";
import { parseTextToObj, parseText } from "./Utils";
import log from "log4js";
import crypto from "crypto";

export class Server {
  public client: Client;
  public proxyNetID: number;
  public meta: string;
  public config: ProxyConfig;
  public proxy: Proxy;
  public klv?: string;

  constructor(public ip: string, public port: number) {
    this.client = new Client({
      enet: {
        ip,
        port,
        maxPeers: 1024,
        useNewPacket: {
          asClient: false
        }
      },
      https: {
        port,
        enable: true,
        ip
        // type2: true
      }
    });
    // this.client.toggleNewPacket();

    this.config = JSON.parse(readFileSync("./config.json", "utf8"));
    this.proxyNetID = 0;
  }

  public setProxyNetID(netID: number) {
    this.proxyNetID = netID;
  }

  public setProxy(proxy: Proxy) {
    this.proxy = proxy;
  }

  public setMeta(meta: string) {
    this.meta = meta;
  }

  public setKlv(klv: string) {
    this.klv = klv;
  }

  public toFullBuffer(data: Buffer) {
    return data.toString("hex").match(/../g).join(" ");
  }

  public start() {
    this.client
      .on("ready", () => {
        log.getLogger("READY").info("Server Ready!");
      })
      .on("connect", async (netID) => {
        log
          .getLogger("CONNECT")
          .info(`New Client connected to server: ${netID} ProxyID: ${this.proxyNetID}`);

        this.proxy.setServerNetID(netID);
        const req = await this.request();
        // console.log({
        //   req,
        //   peerID: this.proxyNetID,
        //   port: parseInt((req.port as string).replace(/(\r)/gm, ""))
        // });

        if (!this.proxy.onsendserver) this.setMeta((req.meta as string).replace(/(\r)/gm, ""));
        // this.setMeta((req.meta as string).replace(/(\r)/gm, ""));
        const connected = this.proxy.client.connect(
          (req["server"] as string).replace(/(\r)/gm, ""),
          // "213.179.209.168",
          this.proxy.onsendserver
            ? this.proxy.onsendserver.port
            : parseInt((req.port as string).replace(/(\r)/gm, "")),
          // 17186,
          this.proxyNetID
        );

        if (connected)
          log
            .getLogger("CONNECT")
            .info(
              `Connecting proxy to ${req.server}:${
                this.proxy.onsendserver ? this.proxy.onsendserver.port : req.port
              }`
            );
      })
      .on("raw", (netID, data) => {
        console.log(`[${netID}] Server Received`, this.toFullBuffer(data), "\n");
        const type = data.readUInt32LE(0);
        const peerProxy = new Peer(this.proxy.client, this.proxyNetID);
        const peer = new Peer(this.client, this.proxy.serverNetID);

        switch (type) {
          case PacketTypes.ACTION: {
            const parsed = parseTextToObj(data);

            if ((parsed.action as string).replace(/\x00/gm, "") === "quit") {
              if (this.proxyNetID > -1) this.proxy.client._client.disconnect(this.proxyNetID);
            }

            log
              .getLogger(ansi.yellowBright("ACTION"))
              .info(`[${netID}] Server Received\n`, data.subarray(4).toString());

            peerProxy.send(data);

            break;
          }

          case PacketTypes.STR: {
            let str = data.subarray(4).toString();
            let strObj = parseTextToObj(str);

            if (strObj["requestedName"]) {
              const klv = this.generate_klv(
                parseInt(strObj.protocol as string),
                strObj.game_version as string,
                strObj.rid as string
              );
              // console.log("klv", klv);

              strObj.meta = this.meta;
              strObj.country = "jp";
              if (!this.klv) this.setKlv(strObj.klv as string);
              strObj.klv = this.klv;
            }

            const buf = Buffer.alloc(4 + str.length);
            buf.writeUint32LE(2, 0);
            buf.write(parseText(strObj), 4);

            // console.log(this.toFullBuffer(buf));
            data = buf;

            log
              .getLogger(ansi.cyan(`STRING`))
              .info(`[${netID}] Server Received\n`, data.subarray(4).toString());

            peerProxy.send(data);

            break;
          }

          case PacketTypes.TANK: {
            const tankType = data.readUint8(4);
            log
              .getLogger(ansi.blueBright(`TANK | Length: ${data.length}`))
              .info(`[${netID}] Server Received ${TankTypes[tankType]}`);

            switch (tankType) {
              case TankTypes.SEND_ITEM_DATABASE_DATA: {
                // ignore
                peerProxy.send(data);

                break;
              }

              case TankTypes.DISCONNECT: {
                console.log(TankPacket.fromBuffer(data));
                // peerProxy.send(data);
                // this.proxy.client._client.disconnectNow(this.proxyNetID);
                this.proxy.client._client.disconnect(this.proxyNetID);
                this.client._client.disconnect(netID);
                // this.client._client.disconnectNow(netID);
                break;
              }

              case TankTypes.CALL_FUNCTION: {
                const variant = Variant.toArray(data);

                log
                  .getLogger(`${VariantTypes[variant[0].type]} | VariantList`)
                  .info("\n", variant.map((v) => `[${v.index}]: ${v.value}`).join("\n"));
                peerProxy.send(data);

                break;
              }

              default: {
                log.getLogger(`${TankTypes[tankType]}`).info(`${this.toFullBuffer(data)}`);
                peerProxy.send(data);

                break;
              }
            }

            break;
          }
        }
      })
      .on("disconnect", (netID) => {
        console.log("Client disconnected", netID);
        this.proxy.client._client.disconnect(this.proxyNetID);
      })
      .listen();
  }

  private async request() {
    // const ip = await axios({
    //   method: "GET",
    //   url: "https://dns.google/resolve?name=www.growtopia1.com&type=A"
    // });
    // console.log({ ip });
    const res = await axios({
      method: "POST",
      url: `https://36.91.215.216/growtopia/server_data.php?platform=0&protocol=201&version=4.47`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
        "User-Agent": "UbiServices_SDK_2022.Release.9_PC64_ansi_static",
        Host: "www.growtopia1.com"
      },
      data: "version=4.47&platform=0&protocol=201",
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    if (res.status !== 200) return null;
    return parseTextToObj(res.data);
  }

  public generate_klv(protocol: number, version: string, rid: string) {
    const salts = [
      "e9fc40ec08f9ea6393f59c65e37f750aacddf68490c4f92d0d2523a5bc02ea63",
      "c85df9056ee603b849a93e1ebab5dd5f66e1fb8b2f4a8caef8d13b9f9e013fa4",
      "3ca373dffbf463bb337e0fd768a2f395b8e417475438916506c721551f32038d",
      "73eff5914c61a20a71ada81a6fc7780700fb1c0285659b4899bc172a24c14fc1"
    ];

    const values = [
      crypto
        .createHash("sha256")
        .update(
          crypto
            .createHash("md5")
            .update(crypto.createHash("sha256").update(`${protocol}`).digest("hex"))
            .digest("hex")
        )
        .digest("hex"),
      crypto
        .createHash("sha256")
        .update(crypto.createHash("sha256").update(version).digest("hex"))
        .digest("hex"),
      crypto
        .createHash("sha256")
        .update(crypto.createHash("sha256").update(`${protocol}${salts[3]}`).digest("hex"))
        .digest("hex")
    ];

    const generate_rid = crypto
      .createHash("sha256")
      .update(crypto.createHash("md5").update(rid).digest("hex"))
      .digest("hex");

    return crypto
      .createHash("sha256")
      .update(values[0] + salts[0] + values[1] + salts[1] + generate_rid + salts[2] + values[2])
      .digest("hex");
  }
}
