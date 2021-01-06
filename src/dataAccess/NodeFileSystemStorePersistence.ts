import { ILogger, Logger } from "../Logger";
import { IStorePersistence } from "./IStorePersistence";
const fs = require("fs");

export class NodeFileSystemStorePersistence implements IStorePersistence {
    private logger: Logger;
    private persistenceDir: string;
    private storeFilename: string;
    constructor(persistenceDir = "appData", storeFilename = "store.json", logger: ILogger = new Logger()) {
        this.persistenceDir = persistenceDir;
        this.storeFilename = storeFilename;
        this.logger = logger;
    }
    private getFilePath(): string {
        return this.persistenceDir + "/" + this.storeFilename;
    }
    private createStorePathIfNotExists(): Promise<any> {
        return fs.promises.access(this.persistenceDir)
            .then(() => 
                fs.promises.access(this.getFilePath())
                    .catch(e => {
                        this.logger.log(e);
                        return fs.promises.writeFile(this.getFilePath(), "")
                            .then(() => false);
                    })
            )
            .then(() => true)
            .catch(e => {
                this.logger.log(e);
                return fs.promises.mkdir(this.persistenceDir)
                    .then(() => {
                        return fs.promises.writeFile(this.getFilePath(), "")
                            .catch(e => {
                                this.logger.log(e);
                                this.logger.log(`failed to create file ${this.storeFilename} at path ${this.persistenceDir}.`);
                                return false;
                            })
                    })
                    .then(() => false)
                    .catch(e => {
                        this.logger.log(e);
                        this.logger.log(`failed to create directory ${this.persistenceDir}.`);
                        return false;
                    });
            });
    }
    async save(payload: string): Promise<boolean> {
        return fs.promises.writeFile(this.getFilePath(), payload).then(() => true).catch(e => {this.logger.log(e); return false});
    }
    async load(): Promise<string> {
        return this.createStorePathIfNotExists()
            .then(() => fs.promises.readFile(this.getFilePath())
                .then(serializedStoreBuffer => serializedStoreBuffer.toString())
                .catch(e => {
                    this.logger.log(e); 
                    return "";
                })
        );
    }
}