import React, { useState } from 'react';

const AGE_UNITS = [
    { key: 'years', label: 'YEARS', icon: 'calendar2-heart', color: 'primary' },
    { key: 'months', label: 'MONTHS', icon: 'calendar2-month', color: 'info' },
    { key: 'days', label: 'DAYS', icon: 'calendar2-day', color: 'warning' },
    { key: 'totalDays', label: 'TOTAL DAYS', icon: 'calendar2-check', color: 'success', format: true }
];

const FUN_FACTS = [
    {
        icon: 'heart-pulse',
        color: 'danger',
        title: 'Heart Beats',
        content: (age) => `Your heart has beaten about ${(age.totalDays * 24 * 60 * 70).toLocaleString()} times`
    }
];

const AgeCard = ({ unit, value }) => (
    <div className="col-md-3 col-6">
        <div className={`card age-card bg-${unit.color} text-white h-100`}>
            <div className="card-body text-center p-3">
                <div className="display-6 fw-bold">
                    {unit.format ? value.toLocaleString() : value}
                </div>
                <div className="small">{unit.label}</div>
                <div className="age-icon mt-2">
                    <i className={`bi bi-${unit.icon} fs-4`}></i>
                </div>
            </div>
        </div>
    </div>
);

const FunFactItem = ({ fact, age }) => (
    <div className="col-md-4 col-sm-6">
        <div className="d-flex align-items-start">
            <i className={`bi bi-${fact.icon} text-${fact.color} fs-5 me-3 mt-1`}></i>
            <div>
                <h6 className="fw-semibold mb-1">{fact.title}</h6>
                <p className="text-muted mb-0 small">{fact.content(age)}</p>
            </div>
        </div>
    </div>
);

export default function AgeCalculator() {
    const [birthDate, setBirthDate] = useState('');
    const [age, setAge] = useState(null);
    const [error, setError] = useState('');

    const calculateAge = () => {
        setAge(null);
        setError('');

        if (!birthDate) {
            setError('Please select your birth date');
            return;
        }

        const birth = new Date(birthDate);
        const today = new Date();

        if (birth > today) {
            setError('Birth date cannot be in the future');
            return;
        }

        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        let days = today.getDate() - birth.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
        }

        if (months < 0) {
            years--;
            months += 12;
        }

        setAge({
            years,
            months,
            days,
            totalDays: Math.floor((today - birth) / (1000 * 60 * 60 * 24))
        });
    };

    const resetCalculator = () => {
        setBirthDate('');
        setAge(null);
        setError('');
    };

    const maxDate = new Date().toISOString().split('T')[0];

    return (
        <div className="container mt-2">
            <div className="row justify-content-center">
                <div className="col-md-8 col-lg-6">
                    <div className="card">
                        <div className="card-header bg-primary text-white">
                            <h2 className="text-center mb-0">
                                <i className="bi bi-calculator me-2"></i>
                                Age Calculator
                            </h2>
                        </div>

                        <div className="card-body p-4">
                            <div className="mb-4">
                                <label htmlFor="birthDate" className="form-label fw-semibold">
                                    Select Your Birth Date:
                                </label>
                                <input
                                    type="date"
                                    className="form-control form-control-lg"
                                    id="birthDate"
                                    value={birthDate}
                                    onChange={(e) => setBirthDate(e.target.value)}
                                    max={maxDate}
                                />
                            </div>

                            {error && (
                                <div className="alert alert-danger d-flex align-items-center">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    {error}
                                </div>
                            )}

                            <div className="d-grid gap-2 d-md-flex justify-content-md-center mb-4">
                                <button className="btn btn-primary btn-lg px-4" onClick={calculateAge}>
                                    <i className="bi bi-calculator-fill me-2"></i>
                                    Calculate Age
                                </button>
                                <button className="btn btn-outline-secondary btn-lg px-4" onClick={resetCalculator}>
                                    <i className="bi bi-arrow-clockwise me-2"></i>
                                    Reset
                                </button>
                            </div>

                            {age && (
                                <div className="mt-4">
                                    <div className="card ">
                                        <div className="card-body p-4">
                                            <div className="text-center mb-4">
                                                <h3 className="fw-bold text-primary mb-2">Your Age Analysis</h3>
                                                <p className="text-muted">Here's your age broken down in detail</p>
                                            </div>

                                            <div className="row g-3 mb-4">
                                                {AGE_UNITS.map((unit) => (
                                                    <AgeCard key={unit.key} unit={unit} value={age[unit.key]} />
                                                ))}
                                            </div>

                                            <div className="card">
                                                <div className="card-body p-4">
                                                    <div className="d-flex align-items-center mb-3">
                                                        <i className="bi bi-stars text-warning fs-4 me-2"></i>
                                                        <h5 className="card-title mb-0 fw-bold">Amazing Life Facts</h5>
                                                    </div>
                                                    <div className="row g-3">
                                                        {FUN_FACTS.map((fact, index) => (
                                                            <FunFactItem key={index} fact={fact} age={age} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="card-footer text-muted text-center">
                            <small>
                                <i className="bi bi-lightbulb me-1"></i>
                                Select your birth date and click calculate to see your exact age
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}