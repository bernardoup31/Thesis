def PlaceCategoryMapper(cat, person):
    if cat == "Work":
        if person[5] == "Worker 1 sec":
            return ["workplace_1st_sec"]
        elif person[5] == "Worker 2 sec":
            return ["workplace_2nd_sec"]
        elif person[5] == "Worker 3 sec":
            return ["workplace_3rd_sec"]
    
    elif cat == "TakeSomeoneSomewhere":
        pass
    
    elif cat == "Groceries":
        return ["groceries","shop"]
    
    elif cat == "School":
        if person[3] in ["1 Basic", "None"]:
            return ["primary_school"]
        elif person[3] in ["2 Basic", "3 Basic"]:
            return ["secondary_school"]
        else:
            return ["university"]
    
    elif cat == "AroundTheBlock":
        pass
    elif cat == "Workout":
        pass
    elif cat == "VisitFriendFamily":
        pass
    elif cat == "EatOut":
        pass
    elif cat == "Other":
        pass
    elif cat == "LeasureSportOrCulural":
        pass
    elif cat == "PersonalIssues":
        pass
    elif cat == "LeasureOther":
        return ["leisure"]
    elif cat == "Doctor":
        pass
    elif cat == "LeasureCollective":
        pass
    
    return "ALL"