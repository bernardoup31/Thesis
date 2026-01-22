def build_id(person):
    atts = person["attributes"]
    age = atts["ageGroup"].replace("-","_to_").replace("+","_plus").lower()
    section = atts["section"].lower()
    eduLvl = atts["educationLvl"].replace(" ","_").replace("+","_plus").lower()
    econ = atts["economicSituation"].replace(" ","_").lower()
    nat = atts["nationality"].lower()
    residence = atts["residence"].replace(" ","_").lower()
    gend = atts["gender"].replace("Masculino","men").replace("Feminino","women").lower()
    return f"_{gend}__{age}_years__{eduLvl}__{econ}__{nat}__{residence}__sec_{section}"