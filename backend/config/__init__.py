"""IntelliTamed — config package.

Patch optionnel : si le backend MySQL est utilisé sans mysqlclient,
pymysql se fait passer pour MySQLdb (Django exige mysqlclient >= 1.4.3).
"""
import os

if os.environ.get("DATABASE_URL", "").startswith(("mysql://", "mysql+pymysql://")):
    try:
        import MySQLdb  # noqa: F401  (mysqlclient réellement installé)
    except ImportError:
        import pymysql
        pymysql.install_as_MySQLdb()
        # Django vérifie la version de MySQLdb ; pymysql annonce 1.0.3
        import MySQLdb  # noqa: F401  (alias posé par install_as_MySQLdb)
        MySQLdb.version_info = (1, 4, 6, "final", 0)
        MySQLdb.__version__ = "1.4.6"
