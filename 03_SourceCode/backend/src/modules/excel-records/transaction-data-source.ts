import { DataSource, EntityManager } from "typeorm";
/** Only used inside an Excel batch: native repository transactions join this batch's manager. */
export function transactionDataSource(
  source: DataSource,
  manager: EntityManager,
): DataSource {
  return new Proxy(source, {
    get(target, key) {
      if (key === "manager") return manager;
      if (key === "query") return manager.query.bind(manager);
      if (key === "transaction")
        return async (...args: any[]) => {
          const callback = typeof args[0] === "function" ? args[0] : args[1];
          return callback(manager);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
