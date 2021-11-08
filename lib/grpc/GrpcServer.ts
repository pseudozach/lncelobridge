import fs from 'fs';
import assert from 'assert';
import grpc, { Server } from 'grpc';
import { pki, md } from 'node-forge';
import Errors from './Errors';
import Logger from '../Logger';
import { GrpcConfig } from '../Config';
import GrpcService from './GrpcService';
import { BoltzService } from '../proto/boltzrpc_grpc_pb';

class GrpcServer {
  private server: Server;

  constructor(private logger: Logger, private grpcConfig: GrpcConfig, grpcService: GrpcService) {
    this.server = new grpc.Server();

    this.server.addService(BoltzService, {
      getInfo: grpcService.getInfo,
      getBalance: grpcService.getBalance,
      deriveKeys: grpcService.deriveKeys,
      getAddress: grpcService.getAddress,
      sendCoins: grpcService.sendCoins,
      updateTimeoutBlockDelta: grpcService.updateTimeoutBlockDelta,
    });
  }

  public listen = (): void => {
    const { port, host, certpath, keypath } = this.grpcConfig;

    if (!fs.existsSync(certpath) && !fs.existsSync(keypath)) {
      this.generateCertificate(certpath, keypath);
    }

    const cert = fs.readFileSync(certpath);
    const key = fs.readFileSync(keypath);
    // this.logger.error("cert: " + cert);
    // this.logger.error("key: " + key);

    assert(Number.isInteger(port) && port > 1023 && port < 65536, 'port must be an integer between 1024 and 65536');

    // tslint:disable-next-line:no-null-keyword
    const serverCert = grpc.ServerCredentials.createSsl(null,
      [{
        cert_chain: cert,
        private_key: key,
      }],
      false,
    );
    this.logger.info("grpc binding to: " + host + ", " + port);
    const bindCode = this.server.bind(`${host}:${port}`, serverCert);

    if (bindCode !== port) {
      throw Errors.COULD_NOT_BIND(host, port);
    } else {
      this.server.start();
      this.logger.info(`gRPC server listening on: ${host}:${port}`);
    }
  }

  public close = (): Promise<void> => {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        this.logger.info('gRPC server completed shutdown');
        resolve();
      });
    });
  }

  private generateCertificate = (tlsCertPath: string, tlsKeyPath: string): void => {
    const keys = pki.rsa.generateKeyPair(1024);
    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = String(Math.floor(Math.random() * 1024) + 1);

    const date = new Date();
    cert.validity.notBefore = date;
    cert.validity.notAfter = new Date(date.getFullYear() + 5, date.getMonth(), date.getDay());

    const attributes = [
      {
        name: 'organizationName',
        value: 'Boltz autogenerated certificate',
      },
    ];

    cert.setSubject(attributes);
    cert.setIssuer(attributes);

    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2,
            value: 'localhost',
          },
          {
            type: 7,
            ip: '127.0.0.1',
          },
        ],
      },
    ]);

    cert.sign(keys.privateKey, md.sha256.create());

    const certificate = pki.certificateToPem(cert);
    const privateKey = pki.privateKeyToPem(keys.privateKey);

    fs.writeFileSync(tlsCertPath, certificate);
    fs.writeFileSync(tlsKeyPath, privateKey);
  }
}

export default GrpcServer;
export { GrpcConfig };
