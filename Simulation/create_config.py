from extract_config_info import extract_plan_info,extract_vehicle_info
from oporto_default_config import DEFAULT_CONFIG
from config import config

if __name__ == "__main__":
    config["transitModes"] = extract_vehicle_info(config["vehiclesFile"])
    _,_, plans_info = extract_plan_info(config["inputPlansFile"])

    config["activityParams"] = [{"type": k,
                                "typicalDuration": v["avg"]
                                } for k,v in plans_info.items()]
    
    print(DEFAULT_CONFIG(config))