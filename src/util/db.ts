// public modules
import sqlite3 from "sqlite3";

// needed types
import { 
    buyActionType,
    sellActionType,
} from "./types";
export const buyActions: buyActionType[] = [];
export const sellActions: sellActionType[] = [];

const sqlite3Verbose = sqlite3.verbose();


// Open a database connection
const db = new sqlite3Verbose.Database("./trading.db", (err) => {
    if (err) {
      return console.error(err);
    }
    console.log("--------------- Connected to the SQlite database --------------");
}); // In-memory database for demonstration, you can specify a file path for persistent storage

// Create a table
db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS buys (id INTEGER PRIMARY KEY, contractAddress TEXT, purchasedPrice FLOAT, priceFactor INTEGER, platform TEXT, chain TEXT, date TEXT);`,
      (err: any, row: any) => {
        if (err) {
          console.error(err.message);
        }
        //   console.log(row.id + "\t" + row.contractAddress);
      }
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS lastsignal (id INTEGER PRIMARY KEY, signalId INTEGER, date TEXT);`,
      (err: any, row: any) => {
        if (err) {
          console.error(err.message);
        }
        //   console.log(row.id + "\t" + row.contractAddress);
      }
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS lookuptables (id INTEGER PRIMARY KEY, lutAddress TEXT);`,
      (err: any, row: any) => {
        if (err) {
          console.error(err.message);
        }
      }
    )
});

// Create
export const addBuy = async () => {
    return new Promise((resolve, reject) => {
        const purchasedTime = new Date().toISOString();
    
        const data = buyActions.map((buyAction) => [
            buyAction.contractAdress,
            buyAction.price,
            0,
            buyAction.platform,
            buyAction.chain,
            purchasedTime
        ]);
    
      
        // Flatten the data array to prepare for bulk insertion
        const flatData = data.flat();
        // console.log(flatData);
    
        // Contruct placeholders for SQL statement
        const placeholders = buyActions.map(() => "(?, ?, ?, ?, ?, ?)").join(', ');
    
        const sql = `INSERT INTO buys (contractAddress, purchasedPrice, priceFactor, platform, chain, date) VALUES ${placeholders}`;
    
        //Insert all recored to database at once
        db.run(sql, flatData, function(err) {
            if (err) {
            console.error(err);
            reject(err);
            }
            else {
            console.log("bulk insert successful!");
            resolve(this.lastID);
            }
        });
    });
}

const getSolanaTokenAddresses = async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT contractAddress from buys WHERE chain = 'solana'", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    })
}

// Read
export const getSolanaBuys = async () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM buys WHERE chain = 'solana'", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Update
const updateBuy = async (id: number, priceFactor: number) => {
    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE buys SET priceFactor = ? WHERE id = ?",
            [priceFactor, id],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes); // Returns the number of rows affected
                }
            }
        );
    });
}


// Delete
const deleteBuy = async (id: number) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM buys WHERE id = ?", [id], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes); // Returns the number of rows affected
            }
        });
    });
}

export const updateSells = async () => {
    return new Promise((resolve, reject) => {
        const updateData = [];
        const deleteData = [];
        for (const sellAction of sellActions) {
            if (Number(sellAction.priceFactor) >= 2) {
                deleteData.push(
                    sellAction.id
                );
            }
            else {
                updateData.push([
                    sellAction.priceFactor || 0 + 1,
                    sellAction.id,
                ]);
            }
        }
        const flatUpdateData = updateData.flat();
        const flatDeleteData = deleteData.flat();
        console.log("flagUpdateData => ", flatUpdateData);
        console.log("flatDeleteData => ", flatDeleteData);
        try {
            if (flatUpdateData.length > 0) {
                const updatePlaceholders = updateData.map(() => "(?)").join(', ');
                const updateSql = `UPDATE buys SET priceFactor = ${updatePlaceholders} where id = ${updatePlaceholders}`;
                db.run(updateSql, flatUpdateData, function(err) {
                    if (err) {
                    reject(err);
                    }
                });
            }
            if (flatDeleteData.length > 0) {
                const deletePlaceholders = deleteData.map(() => "(?)").join(', ');
                const deleteSql = `DELETE FROM buys where id = ${deletePlaceholders}`;
                db.run(deleteSql, flatDeleteData, function(err) {
                    if (err) {
                    reject(err);
                    }
                });
            }
            resolve("success update sell!");
        } catch (err) {
            reject(err);
        }
    })
}




  

  
  