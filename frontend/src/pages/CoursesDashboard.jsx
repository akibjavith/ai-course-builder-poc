import React, { useEffect, useState } from 'react';
import { getCourses } from '../api';
import { Loader2, BookOpen, Clock, Users } from 'lucide-react';

export default function CoursesDashboard({ onViewCourse }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await getCourses();
      setCourses(res.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Courses</h2>
      
      {courses.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500">
          No courses currently built. Click "Create New Course" above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, idx) => {
             const data = course.details;
             const modCount = course.structure?.modules?.length || 0;
             const firstMod = course.structure?.modules?.[0];
             const chapCount = firstMod?.chapters?.length || 0;

             return (
               <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                  <div className="p-6">
                     <div className="flex justify-between items-start mb-4">
                       <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{data.title}</h3>
                       <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                         data.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                         data.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                         'bg-red-100 text-red-800'
                       }`}>
                         {data.difficulty}
                       </span>
                     </div>
                     
                     <p className="text-sm text-gray-500 mb-6 line-clamp-3 h-14">
                       {data.description}
                     </p>

                     <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 mt-auto">
                        <div className="flex items-center">
                          <BookOpen className="h-4 w-4 text-indigo-500 mr-2" />
                          {modCount} Modules
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-indigo-500 mr-2" />
                          {data.duration}
                        </div>
                        <div className="col-span-2 flex items-center">
                          <Users className="h-4 w-4 text-indigo-500 mr-2" />
                          {data.target_audience}
                        </div>
                     </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                    <button 
                      onClick={() => onViewCourse && onViewCourse(course)}
                      className="text-indigo-600 text-sm font-medium hover:text-indigo-900 w-full text-center"
                    >
                       View Course Details
                    </button>
                  </div>
               </div>
             )
          })}
        </div>
      )}
    </div>
  );
}
