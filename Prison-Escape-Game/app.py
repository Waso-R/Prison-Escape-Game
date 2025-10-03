from flask import Flask, render_template, session, redirect, url_for, request, g
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, close_db
from forms import LoginForm, SignupForm
from functools import wraps

app = Flask(__name__)
app.teardown_appcontext(close_db)
app.config["SECRET_KEY"] = "this-is-my-secret-key"
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

Session(app)

@app.before_request
def load_logged_in_user():
    user_id = session.get("user_id")
    if user_id:
        db = get_db()
        g.user = db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    else:
        g.user = None


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if g.user is None:
            return redirect(url_for("login", next=request.url))
        return view(*args, **kwargs)
    return wrapped_view

############### signup ################
@app.route("/signup", methods=["GET", "POST"])
def signup():
    form = SignupForm()
    
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data
        confirm_password = form.confirm_password.data
        db = get_db()

        if password != confirm_password:
            form.confirm_password.errors.append("Passwords do not match!")
            return render_template("signup.html", form=form)

        conflict_user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

        if conflict_user:
            form.username.errors.append("Username already taken!")
        else:
            db.execute("INSERT INTO users (username, password) VALUES (?, ?)", 
                       (username, generate_password_hash(password)))
            db.commit()
            return redirect(url_for("login"))

    return render_template("signup.html", form=form)

############### login ################
@app.route("/login", methods=['GET', 'POST'])
def login():
    form = LoginForm()
    
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data

        db = get_db()
        user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

        if user is None:
            form.username.errors.append("No such username!")
        elif not check_password_hash(user["password"], password):
            form.password.errors.append("Incorrect password!")
        else:
            session.clear()
            session["user_id"] = user["user_id"]
            next_page = request.args.get("next") or url_for("index")
            return redirect(next_page)

    return render_template("login.html", form=form)

############### logout ################
@app.route("/logout")
@login_required
def logout():
    session.clear()
    return redirect(url_for("index"))


########## Home Page ############
@app.route('/')
def index():
    return render_template('index.html')

############### game.html ################
@app.route("/game")
@login_required
def game():
    return render_template("game.html")

############### attributions.html ################
@app.route("/attributions")
@login_required
def attributions():
    return render_template("attributions.html")


if __name__ == '__main__':
    app.run(debug=True)